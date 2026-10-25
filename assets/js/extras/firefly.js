(function (root) {
  'use strict';
  const ID = 'firefly', X = 60, Y = 150, SIZE = 600;
  // Boards are made by legal presses from all-on. The solver independently
  // minimizes all 512 / 65536 possible press sets, including the 4x4 nullspace.
  const LEVELS = [
    { n: 3, presses: [4] }, { n: 3, presses: [0,8] }, { n: 3, presses: [0,4,8] },
    { n: 3, presses: [0,2,6,8] }, { n: 3, presses: [0,2,4,6,8] },
    { n: 4, presses: [2,5,14] }, { n: 4, presses: [2,4,10,12] },
    { n: 4, presses: [0,2,6,8,11] }, { n: 4, presses: [0,5,7,8,11,12] },
    { n: 4, presses: [2,3,5,6,7,9,10] }
  ];
  LEVELS.forEach(l => { Object.freeze(l.presses); Object.freeze(l); }); Object.freeze(LEVELS);
  const tables = new Map(), endings = new WeakMap();
  function pop(n) { let count = 0; for (; n; n &= n - 1) count++; return count; }
  function influence(n, index) { const x = index % n, y = Math.floor(index / n); let mask = 0; for (const [dx, dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < n && yy >= 0 && yy < n) mask |= 1 << (yy * n + xx); } return mask; }
  function table(n) {
    if (tables.has(n)) return tables.get(n);
    const masks = Array.from({ length: n * n }, (_, i) => influence(n, i)), best = new Map(); let previous = 0, effect = 0, count = 0;
    for (let i = 0; i < 1 << n * n; i++) { const gray = i ^ i >>> 1; if (i) { const bit = gray ^ previous, index = 31 - Math.clz32(bit); effect ^= masks[index]; count += gray & bit ? 1 : -1; } const old = best.get(effect); if (!old || count < old.count) best.set(effect, { mask: gray, count }); previous = gray; }
    const value = { masks, best }; tables.set(n, value); return value;
  }
  function solve(s) { const n = LEVELS[s.level].n, best = table(n).best.get(s.mask ^ ((1 << n * n) - 1)); return best ? Array.from({ length: n * n }, (_, index) => ({ type: 'flip', index })).filter(a => best.mask & 1 << a.index) : null; }
  function initial(level) { const l = LEVELS[level]; let mask = (1 << l.n * l.n) - 1; for (const index of l.presses) mask ^= influence(l.n, index); return mask; }
  function create(level = 0, seed = 1) { level = Number.isFinite(level) ? Math.max(0,Math.min(9,Math.floor(level))) : 0; seed >>>= 0; const s = { v: 1, id: ID, level, seed, rng: seed, phase: 'playing', score: 0, stars: 0, moves: 0, t: 0, mask: initial(level), selected: Math.floor(LEVELS[level].n * LEVELS[level].n / 2), par: 0, anims: [] }; s.par = solve(s).length; return s; }
  function center(s, index) { const n = LEVELS[s.level].n, cell = SIZE / n; return { x: X + (index % n + .5) * cell, y: Y + (Math.floor(index / n) + .5) * cell }; }
  function flip(s, index) {
    const n = LEVELS[s.level].n; if (!Number.isInteger(index) || index < 0 || index >= n * n) return { ok: false, events: [] };
    const affected = influence(n, index); s.mask ^= affected; s.selected = index; s.moves++;
    s.anims = s.anims.filter(a => !(affected & 1 << a.index)); for (let i = 0; i < n * n; i++) if (affected & 1 << i) s.anims.push({ index: i, t: 0, delay: i === index ? 0 : .055 });
    const events = [{ type: 'drop', ...center(s,index), color: '#eade8c', rate: .95 + pop(s.mask) / (n*n) * .24 }];
    if (s.mask === (1 << n*n) - 1) { s.phase = 'won'; s.stars = s.moves <= s.par + 2 ? 3 : s.moves <= s.par * 2 + 3 ? 2 : 1; s.score = Math.max(100,1000+s.level*100-Math.max(0,s.moves-s.par)*25); events.push({ type: 'collect', x: 360, y: 410, color: '#ffeba3', count: 14 }); }
    return { ok: true, events };
  }
  function under(s, p) { if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return -1; const n = LEVELS[s.level].n, cell = SIZE/n, x = Math.floor((p.x-X)/cell), y = Math.floor((p.y-Y)/cell); return x<0 || y<0 || x>=n || y>=n ? -1 : y*n+x; }
  function act(s, type, p = {}) {
    if (s.phase !== 'playing') return { ok: false, events: [] };
    if (type === 'flip') return flip(s,p.index === undefined ? s.selected : p.index);
    if (type === 'pointerup') { const start = p.start || p; if (!Number.isFinite(start.x) || !Number.isFinite(start.y) || Math.hypot(p.x-start.x,p.y-start.y)>24 || under(s,start)!==under(s,p)) return { ok: false, events: [] }; return flip(s,under(s,p)); }
    const n = LEVELS[s.level].n, delta = { left: -1, right: 1, up: -n, down: n }[type]; if (delta) { s.selected = (s.selected + delta + n*n) % (n*n); return { ok: true, events: [] }; }
    return { ok: false, events: [] };
  }
  function step(s, dt) { if (s.phase!=='playing' || !Number.isFinite(dt) || dt<=0) return []; dt=Math.min(.1,dt); s.t+=dt; for (const a of s.anims) a.t+=dt; s.anims=s.anims.filter(a=>a.t<a.delay+.55); return []; }
  function hint(s) { const next=solve(s)?.[0], n=LEVELS[s.level].n; return next ? { text: `点第 ${Math.floor(next.index/n)+1} 行、第 ${next.index%n+1} 列的小萤火虫。它和上下左右的伙伴会一起改变。`, targets: [center(s,next.index)], move: next } : { text: '大家都亮起来啦！', targets: [] }; }
  function rr(c,x,y,w,h,r,fill) { c.fillStyle=fill; c.beginPath(); c.roundRect(x,y,w,h,r); c.fill(); }
  function star(c,x,y,r,fill) { c.fillStyle=fill; c.beginPath(); for (let i=0;i<10;i++) { const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.45:r; i?c.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d):c.moveTo(x+Math.cos(a)*d,y+Math.sin(a)*d); } c.closePath(); c.fill(); }
  function background(c,n) {
    const g=c.createLinearGradient(0,0,0,800); g.addColorStop(0,'#1f2949'); g.addColorStop(1,'#28594f'); c.fillStyle=g; c.fillRect(0,0,720,800);
    for (let i=0;i<30;i++) { c.fillStyle=i%3?'#dfeac350':'#f8dc8c80'; c.beginPath(); c.arc((i*173+15)%720,(i*57+22)%800,i%2+1,0,7); c.fill(); }
    c.fillStyle='#ffe8ab'; c.beginPath(); c.arc(632,68,29,0,7); c.fill(); c.fillStyle='#202d49'; c.beginPath(); c.arc(643,59,28,0,7); c.fill();
    rr(c,35,25,650,98,26,'#17263d80'); c.fillStyle='#fff1bf'; c.font='bold 29px sans-serif'; c.textAlign='left'; c.fillText('唤醒一整片萤火星光',60,66); c.fillStyle='#bdd6ca'; c.font='19px sans-serif'; c.fillText('点一下 · 自己和上下左右一起亮／暗',60,101);
    rr(c,X-12,Y-12,624,624,32,'#183c3d'); const cell=SIZE/n;
    for (let i=0;i<n*n;i++) { const x=X+(i%n+.5)*cell,y=Y+(Math.floor(i/n)+.5)*cell; rr(c,x-cell/2+5,y-cell/2+5,cell-10,cell-10,27,'#3b635c'); rr(c,x-cell/2+9,y-cell/2+9,cell-18,cell-18,24,(i+Math.floor(i/n))%2?'#31564f':'#345b53'); c.save(); c.translate(x,y+cell*.16); c.rotate(-.2); c.fillStyle='#476f53'; c.beginPath(); c.ellipse(0,0,cell*.35,cell*.2,0,0,7); c.fill(); c.strokeStyle='#64865d'; c.lineWidth=2; c.beginPath(); c.moveTo(-cell*.3,0); c.lineTo(cell*.3,0); for(let j=-2;j<=2;j++){c.moveTo(j*cell*.1,0);c.lineTo((j+.8)*cell*.1,-cell*.13);} c.stroke(); c.restore(); }
    c.fillStyle='#afcec1'; c.font='17px sans-serif'; c.textAlign='center'; c.fillText('星星 = 亮着 · 月牙 = 睡着 · 没有时间限制',360,788);
  }
  function bug(c,x,y,size,on,age,reduced) {
    const active=age>=0&&age<.55&&!reduced, u=active?age/.55:1, swell=active?Math.sin(u*Math.PI)*.12:0, flutter=active?Math.sin(u*Math.PI*5)*.2:0;
    c.save(); c.translate(x,y); c.scale(size/150*(1+swell),size/150*(1+swell));
    if(on){c.fillStyle='#ffe48416'; c.beginPath(); c.arc(0,5,54,0,7); c.fill(); c.fillStyle='#fff1ac20'; c.beginPath(); c.arc(0,5,39,0,7); c.fill();}
    for(const sign of [-1,1]){c.save(); c.translate(sign*7,-6); c.rotate(sign*(on?.5+flutter:.08+flutter)); c.fillStyle=on?'#c8ead39c':'#72968d'; c.beginPath(); c.ellipse(sign*18,0,on?17:12,30,sign*.35,0,7); c.fill(); c.strokeStyle=on?'#e8f4ce':'#94afa0'; c.lineWidth=2; c.stroke(); c.restore();}
    c.fillStyle=on?'#f1cd62':'#566b85'; c.beginPath(); c.ellipse(0,13,19,29,0,0,7); c.fill(); c.fillStyle=on?'#fff0a4':'#3b4d70'; c.beginPath(); c.ellipse(0,23,15,17,0,0,7); c.fill();
    c.fillStyle=on?'#d9bc68':'#556780'; c.beginPath(); c.arc(0,-17,19,0,7); c.fill(); c.strokeStyle=on?'#b5cba0':'#849d96'; c.lineWidth=3; c.beginPath(); c.moveTo(-8,-30); c.quadraticCurveTo(-20,-48,-26,-38); c.moveTo(8,-30); c.quadraticCurveTo(20,-48,26,-38); c.stroke();
    c.strokeStyle='#29454c'; c.lineWidth=3; if(on){c.fillStyle='#29454c'; c.beginPath(); c.arc(-7,-19,2.7,0,7); c.arc(7,-19,2.7,0,7); c.fill(); c.beginPath();c.arc(0,-13,5,0,Math.PI);c.stroke();}else{c.beginPath();c.moveTo(-11,-18);c.quadraticCurveTo(-7,-13,-3,-18);c.moveTo(3,-18);c.quadraticCurveTo(7,-13,11,-18);c.stroke();}
    if(on)star(c,0,24,10,'#fff9cf');else{c.fillStyle='#b9c5e4';c.beginPath();c.arc(1,23,10,0,7);c.fill();c.fillStyle='#3b4d70';c.beginPath();c.arc(6,19,9,0,7);c.fill();}
    if(active&&on){for(let i=0;i<4;i++){const a=i*Math.PI/2+.4,r=38+u*23;c.globalAlpha=1-u;star(c,Math.cos(a)*r,Math.sin(a)*r,3.5,'#fff2ab');}c.globalAlpha=1;}
    c.restore();
  }
  function draw(c,s,view={}) {
    const n=LEVELS[s.level].n,cell=SIZE/n;let endAge=0;if(s.phase!=='playing'){if(!endings.has(s)&&view.dt)endings.set(s,view.time||0);endAge=endings.has(s)?Math.max(0,(view.time||0)-endings.get(s)):1;}
    if(!root.ExtraRender?.layer(c,`${ID}-${n}`,layer=>background(layer,n)))background(c,n);
    const preview=under(s,view.pointer?.target),selected=preview>=0?preview:s.selected,neighbors=influence(n,selected);
    for(let i=0;i<n*n;i++){const p=center(s,i),on=!!(s.mask&1<<i),a=s.anims.find(a=>a.index===i),age=a?a.t+endAge-a.delay:-1;
      if(neighbors&1<<i){c.strokeStyle=i===selected?'#f9e3a1':'#adc6a94d';c.lineWidth=i===selected?4:2;c.beginPath();c.roundRect(p.x-cell/2+10,p.y-cell/2+10,cell-20,cell-20,23);c.stroke();}
      bug(c,p.x,p.y-3,cell*.88,on,age,view.reduced);
      c.fillStyle=on?'#f4e4a2':'#b2c7ca';c.font=`bold ${n===3?18:16}px sans-serif`;c.textAlign='center';c.fillText(on?'亮着':'睡着',p.x,p.y+cell*.37);
    }
  }
  function hud(s) { const n=LEVELS[s.level].n;return{scoreLabel:'亮着的伙伴',score:`${pop(s.mask)} / ${n*n}`,statLabel:'点亮次数',stat:s.moves,goal:'让所有萤火虫同时亮起来',progress:pop(s.mask)/(n*n),message:'改变会传给上下左右，不会传给斜角。点同一格两次会恢复。'}; }
  function controls(s) {const n=LEVELS[s.level].n;return[{id:'left',label:'上一只'},{id:'flip',label:`点第 ${Math.floor(s.selected/n)+1} 行 ${s.selected%n+1} 列`},{id:'right',label:'下一只'}];}
  function validate(s) {
    const nat=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max,finite=(v,max)=>Number.isFinite(v)&&v>=0&&v<=max;
    if(!s||s.v!==1||s.id!==ID||!nat(s.level,9)||!nat(s.seed,4294967295)||s.rng!==s.seed||!['playing','won'].includes(s.phase)||!nat(s.moves,10000000)||!finite(s.t,10000000))return false;
    const n=LEVELS[s.level].n,all=(1<<n*n)-1;
    if(!nat(s.mask,all)||!nat(s.selected,n*n-1)||s.par!==create(s.level,s.seed).par||!Array.isArray(s.anims)||s.anims.length>n*n||!table(n).best.has(s.mask^all))return false;
    const distance=table(n).best.get(s.mask^initial(s.level));if(!distance||distance.count>s.moves||(distance.count&1)!==(s.moves&1)||(!s.moves&&s.anims.length))return false;
    if(s.anims.some(a=>!a||!nat(a.index,n*n-1)||!finite(a.t,.605)||(a.delay!==0&&a.delay!==.055))||new Set(s.anims.map(a=>a.index)).size!==s.anims.length)return false;
    const won=s.mask===all;if((s.phase==='won')!==won)return false;
    if(!won)return s.stars===0&&s.score===0;
    return s.moves>0&&s.stars===(s.moves<=s.par+2?3:s.moves<=s.par*2+3?2:1)&&s.score===Math.max(100,1000+s.level*100-Math.max(0,s.moves-s.par)*25);
  }
  const G={id:ID,meta:{title:'萤火灯阵',category:'解谜',blurb:'点亮小萤火虫和它的邻居，让整片夜色闪起星光。',tags:['逻辑','规律','观察'],color:'#b4c786',instructions:['点击一只萤火虫，自己和上下左右的伙伴都会改变亮暗。斜角不会改变。','星星表示亮着，月牙表示睡着。让所有伙伴同时亮起来就过关。','同一格点两次会恢复原样。没有倒计时，可用提示、撤销和下方大按钮。']},levels:10,create,act,step,draw,hud,controls,hint,validate,solve,center,influence,layouts:LEVELS,needsFrame:s=>s.phase==='playing'&&s.anims.length>0};
  (root.ExtraGames||(root.ExtraGames={}))[ID]=G;if(typeof module!=='undefined'&&module.exports)module.exports=G;
})(typeof globalThis!=='undefined'?globalThis:this);
