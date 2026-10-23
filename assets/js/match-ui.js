'use strict';
(() => {
  const $ = id => document.getElementById(id), id = document.body.dataset.game;
  const bird = id === 'birdblast', C = bird ? BirdCore : MatchCore, A = MatchArt, N = 7, W = 700;
  const key = `childgame.match.${id}.v1`, progressKey = `${key}.progress`, reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clone = o => JSON.parse(JSON.stringify(o)), canvas = $('board'), ctx = canvas.getContext('2d');
  const names = bird ? ['珊瑚鸟','金黄鸟','蓝天鸟','青柠鸟','紫羽鸟'] : id === 'candyland' ? ['草莓糖','柠檬糖','蓝莓糖','青苹果糖','葡萄糖'] : ['红宝石','黄宝石','蓝宝石','绿宝石','紫水晶'];
  const specials = {row:'横向条纹',col:'纵向条纹',bomb:'包装炸弹',rainbow:'彩色炸弹',glow:'发光小鸟',fire:'燃火小鸟',lightning:'闪电小鸟',whirlwind:'黑旋风小鸟'};
  const palette = A.theme(id).colors;
  const modeNames = {practice:'慢慢练习',classic:'经典上升',pandora:'潘多拉',ice:'破冰挑战',fever:'狂热冲分'};
  let s = C.fresh(id), sound = true, progress = {}, history = [], selected = -1, hints = [], drag = null;
  let view, active = null, queue = [], raf = 0, busy = false, paused = false, lastClock = 0, clockSave = 0;
  let messageTimer = 0, pending = null, suppressClick = 0, ratio = 1, lastGoals = '', lastResult = '';
  const particles = [], rings = [], beams = [], sprites = new Map(), cells = [];
  try { s = C.restore(id, JSON.parse(localStorage.getItem(key))); sound = localStorage.getItem('childgame.sound') !== 'off'; progress = JSON.parse(localStorage.getItem(progressKey)) || {}; } catch {}
  A.setTheme(id); view = clone(s);
  const timed = () => s.phase === 'playing' && (s.timeLeft != null || bird && s.mode === 'classic');
  // Restored timed rounds wait for a deliberate resume, including standalone Safari.
  paused = timed();
  const audio = createGameAudio({game:id,music:false,isEnabled:()=>sound,isPlaying:()=>s.phase==='playing',isPaused:()=>paused||$('dialog').open});
  const text = (name, value) => { const el = $(name); if(el && el.textContent !== String(value)) el.textContent = value; };
  const point = i => ({x:(i%N+.5)*100,y:(Math.floor(i/N)+.5)*100});
  const top = (board,col) => board.findIndex((tile,i)=>tile&&i%N===col);
  function say(value) { text('feedback',value); }
  function save() {
    try { localStorage.setItem(key,JSON.stringify(s)); text('save-status','进度已保存 · 支持离线游玩'); }
    catch { text('save-status','暂时无法保存，请先不要关闭页面'); }
  }
  function saveWin() {
    if(s.phase !== 'won') return;
    const pkey = bird ? `${s.mode}:${s.level}` : String(s.level);
    progress[pkey] = Math.max(Number(progress[pkey])||0,s.score);
    try { localStorage.setItem(progressKey,JSON.stringify(progress)); } catch {}
  }
  function cfg() { return C.level(id,s.level,s.mode); }
  function populateLevels() {
    $('levels').replaceChildren(...C.levels(id,s.mode).map((level,i)=>{
      const option=document.createElement('option');option.value=i;
      const done=progress[bird?`${s.mode}:${i}`:String(i)];option.textContent=`${i+1}. ${level.name}${done?' ✓':''}`;return option;
    })); $('levels').value=s.level;
    if($('mode')) $('mode').value=s.mode||'practice';
  }
  function status() {
    const conf=cfg(),shown=busy&&active?.frame.stats?{...s,...active.frame.stats}:s;
    text('level-title',`${s.level+1} / 12 · ${conf.name}`);
    text('level-note',bird?'移动各列最顶端的小鸟，同色连通 3 只就爆破。':id==='candyland'?'交换相邻糖果，四连、五连和 T/L 形能合成特殊糖果。':'先解开锁链，再消除宝箱下方的宝石，让宝箱落到底部。');
    text('moves-label',s.movesLeft==null?'已经移动':'剩余步数');text('moves',s.movesLeft == null ? `${s.movesUsed} 次` : `${shown.movesLeft} 步`); text('score',shown.score);
    if($('timer')) {
      $('timer').closest('.counter').hidden=s.timeLeft==null&&!(bird&&s.mode==='classic');
      text('timer',s.timeLeft!=null?`${Math.ceil(shown.timeLeft)} 秒`:`${Math.ceil(s.riseLeft||0)} 秒`);
      $('timer').previousElementSibling.textContent=s.timeLeft!=null?'剩余时间':'下一次上升';
    }
    $('pause').hidden=!(s.timeLeft!=null||bird&&s.mode==='classic');text('pause',paused?'▶ 继续':'Ⅱ 暂停');
    $('pause').disabled=s.phase!=='playing';
    const goal=s.goals, parts=[];
    for(const item of goal.colors||[]) parts.push(`<span class="goal"><i style="background:${palette[item.color]}"></i><span>${names[item.color]}</span><strong>${Math.min(item.count,shown.collected[item.color])}/${item.count}</strong></span>`);
    if(goal.score) parts.push(`<span class="goal">⭐ <span>目标分</span><strong>${Math.min(shown.score,goal.score)}/${goal.score}</strong></span>`);
    if(goal.covers) parts.push(`<span class="goal">${bird?'🧊':'❄️'} <span>${bird?'冰块':'果冻'}</span><strong>${Math.min(shown.clearedCovers,goal.covers)}/${goal.covers}</strong></span>`);
    if(goal.locks) parts.push(`<span class="goal">🔓 <span>锁链</span><strong>${Math.min(shown.clearedLocks,goal.locks)}/${goal.locks}</strong></span>`);
    if(goal.rescue) parts.push(`<span class="goal">${id==='candyland'?'🍒':'💎'} <span>${id==='candyland'?'收集果实':'宝箱到底'}</span><strong>${Math.min(shown.rescued,goal.rescue)}/${goal.rescue}</strong></span>`);
    if(!parts.length) parts.push(`<span class="goal">${s.mode==='classic'?'⬆️ 别让小鸟碰到顶端':'⭐ 试试能得到多少分'}</span>`);
    const markup=parts.join('');if(markup!==lastGoals){$('goals').innerHTML=markup;lastGoals=markup;}
    $('undo').disabled=!history.length; $('hint').disabled=s.phase!=='playing'||busy||paused; $('shuffle').disabled=s.phase!=='playing'||busy||paused;
    if($('result-undo'))$('result-undo').disabled=!history.length;
    const finished=!busy&&s.phase!=='playing';$('result').hidden=!finished;
    const resultKey=`${s.phase}:${s.score}:${s.level}`;
    if(finished&&resultKey!==lastResult){
      lastResult=resultKey;text('result-title',s.phase==='won'?'太棒啦！这一关完成了':'再试一次，也可以撤销');
      text('result-text',s.phase==='won'?`获得 ${s.score} 分${s.level===11?' · 十二关都体验过后，还可以挑战更高分。':'，准备好再出发吧。'}`:`这次获得 ${s.score} 分。调整顺序，特殊组合会很有帮助。`);
      text('next',s.level<11?'下一关 →':'回到第一关');$('next').hidden=s.phase!=='won';
    }
    updateCells();
  }
  function updateCells() {
    for(let i=0;i<49;i++) {
      const el=cells[i],t=s.board[i],isTop=bird&&t&&!s.covers[i]&&top(s.board,i%7)===i;
      el.classList.toggle('selected',i===selected);el.classList.toggle('hinted',hints.includes(i));el.classList.toggle('top-bird',!!isTop);
      const label=`第${Math.floor(i/7)+1}行第${i%7+1}列 ${t?(t.kind==='chest'?'宝箱':t.kind==='ingredient'?'樱桃':names[t.color]||'小鸟')+(t.special?`，${specials[t.special]||t.special}`:'')+(s.covers[i]?'，有覆盖层':'')+(s.locks[i]?'，有锁链':''):'空位'}${isTop?'，可以移动的顶端':''}`;
      if(el.getAttribute('aria-label')!==label)el.setAttribute('aria-label',label);
      const pressed=String(i===selected);if(el.getAttribute('aria-pressed')!==pressed)el.setAttribute('aria-pressed',pressed);
      const disabled=s.phase!=='playing'||paused;if(el.disabled!==disabled)el.disabled=disabled;
    }
  }
  for(let i=0;i<49;i++){const el=document.createElement('button');el.type='button';el.dataset.cell=i;el.tabIndex=i===0?0:-1;cells.push(el);$('cells').append(el);}
  function sprite(tile) {
    const key=`${tile.kind}:${tile.color}:${tile.special}`;
    if(!sprites.has(key)){const c=document.createElement('canvas');c.width=c.height=192;A.draw(c.getContext('2d'),tile,0,0,192);sprites.set(key,c);}
    return sprites.get(key);
  }
  function obstacle(kind,hp) {
    const key=`${kind}:${hp}`;if(!sprites.has(key)){
      const c=document.createElement('canvas');c.width=c.height=192;const g=c.getContext('2d');
      if(kind==='lock')A.lock(g,0,0,192);else A.cover(g,kind,hp,0,0,192);sprites.set(key,c);
    } return sprites.get(key);
  }
  function draw(now=performance.now()) {
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,W,W);
    const frame=active?.frame, show=frame||view, u=active?Math.min(1,(now-active.start)/active.duration):1;
    const moving=frame&&['swap','move','fall','rise','shuffle'].includes(frame.kind);
    const oldMap=moving?active.oldMap:null, removed=frame?.kind==='clear'?active.removed:null;
    for(let i=0;i<49;i++){
      const p=point(i);ctx.fillStyle=(Math.floor(i/7)+i%7)%2?'#ffffff13':'#ffffff24';ctx.beginPath();ctx.roundRect(p.x-47,p.y-47,94,94,19);ctx.fill();
    }
    for(let i=0;i<49;i++){
      const t=show.board[i];if(!t)continue;
      const p=point(i);let x=p.x,y=p.y,scale=1,opacity=1;
      if(moving){
        const before=oldMap.get(t.uid),from=before==null?{x:p.x,y:-70-(i%3)*65}:point(before);
        // A brief landing squash follows the fall; positions interpolate without DOM layout.
        const progress=frame.kind==='fall'?1-Math.pow(1-u,2):u;
        x=from.x+(p.x-from.x)*progress;y=from.y+(p.y-from.y)*progress;
        if(frame.kind==='fall'&&u>.8)scale=1+Math.sin((u-.8)/.2*Math.PI)*.07;
      }
      if(removed?.has(i)){scale=Math.max(.04,1-u*.94);opacity=1-u;}
      if(frame?.kind==='rescue'&&frame.rescued.includes(i)){y+=u*95;scale=1-u*.5;opacity=1-u;}
      if(drag?.source===i&&drag.moved&&!busy){x=drag.wx;y=drag.wy;scale=1.08;}
      ctx.globalAlpha=opacity;ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.drawImage(sprite(t),-47,-47,94,94);ctx.restore();ctx.globalAlpha=1;
      if(bird&&show.covers?.[i])ctx.drawImage(obstacle('ice',show.covers[i]),x-47,y-47,94,94);
      if(show.locks?.[i])ctx.drawImage(obstacle('lock',1),x-47,y-47,94,94);
    }
    // Jelly belongs to a board square; bird ice belongs to the moving bird.
    if(!bird)for(let i=0;i<49;i++)if(show.covers?.[i]){const p=point(i);ctx.drawImage(obstacle('frosting',show.covers[i]),p.x-47,p.y-47,94,94);}
    if(selected>=0&&!busy){const p=point(selected);ctx.strokeStyle='#fff4b8';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(p.x-46,p.y-46,92,92,20);ctx.stroke();}
    paintEffects(now);
    if(paused){ctx.fillStyle='#18384e80';ctx.fillRect(0,0,700,700);ctx.fillStyle='white';ctx.textAlign='center';ctx.font='bold 34px sans-serif';ctx.fillText('已暂停 · 点继续',350,350);}
  }
  function burst(frame,now) {
    const removed=frame.removed||[];
    const stride=Math.max(1,Math.ceil(removed.length/16));
    for(let k=0;k<removed.length;k+=stride){
      const i=removed[k],p=point(i),color=palette[frame.board[i]?.color]||'#ffe18a';
      if(rings.length<16)rings.push({...p,color,start:now,life:360,size:55});
      for(let n=0;n<7&&particles.length<210;n++){
        const a=n*Math.PI*2/7,v=90+Math.random()*135;
        particles.push({...p,color:n%4?color:'#fff0a7',vx:Math.cos(a)*v,vy:Math.sin(a)*v-55,start:now,life:420+Math.random()*220,size:4+Math.random()*6});
      }
    }
    for(const event of (frame.triggered||[]).slice(0,10)) {
      const p=point(event.index),special=event.special,wide=special==='bomb-stripe',cross=wide||special==='stripe-stripe'||special==='fire';
      const ray=(a,b)=>{if(beams.length<30)beams.push({a,b,start:now,life:400,color:special.includes('rainbow')?'#e6c7ff':special==='fire'?'#ffce7d':'#fff6b5',straight:cross||special==='row'||special==='col'});};
      if(cross){for(const offset of wide?[-100,0,100]:[0]){const y=p.y+offset,x=p.x+offset;if(y>0&&y<700){ray({x:p.x,y},{x:0,y});ray({x:p.x,y},{x:700,y});}if(x>0&&x<700){ray({x,y:p.y},{x,y:0});ray({x,y:p.y},{x,y:700});}}}
      else if(special==='row'){ray(p,{x:0,y:p.y});ray(p,{x:700,y:p.y});}
      else if(special==='col'){ray(p,{x:p.x,y:0});ray(p,{x:p.x,y:700});}
      else if(special==='whirlwind'||special.startsWith('rainbow')||special==='lightning')for(const end of [0,6,21,27,42,48].map(point))ray(p,end);
      const full=special==='whirlwind'||special==='rainbow-rainbow',big=wide||special==='bomb-bomb';
      if(rings.length<20)rings.push({...p,color:full?'#e6caff':'#fff3b0',start:now+(special==='fire'?150:0),life:full?650:520,size:full?500:big?250:special.startsWith('bomb')?150:100,swirl:special==='whirlwind'});
    }
    for(const event of (frame.created||[]).slice(0,4))if(rings.length<20)rings.push({...point(event.index),color:'#fff6ad',start:now,life:600,size:85});
  }
  function paintEffects(now) {
    for(let i=beams.length-1;i>=0;i--){const b=beams[i],u=(now-b.start)/b.life;if(u>=1){beams.splice(i,1);continue;}ctx.globalAlpha=1-u;ctx.strokeStyle=b.color;ctx.lineWidth=16*(1-u)+2;ctx.beginPath();ctx.moveTo(b.a.x,b.a.y);const reach=Math.min(1,u*4),dx=(b.b.x-b.a.x)*reach,dy=(b.b.y-b.a.y)*reach;if(!b.straight)for(let j=1;j<5;j++)ctx.lineTo(b.a.x+dx*j/5+(j%2?12:-12),b.a.y+dy*j/5+(j%2?-9:9));ctx.lineTo(b.a.x+dx,b.a.y+dy);ctx.stroke();}
    for(let i=rings.length-1;i>=0;i--){const p=rings[i],u=(now-p.start)/p.life;if(u<0)continue;if(u>=1){rings.splice(i,1);continue;}ctx.globalAlpha=(1-u)*.8;ctx.strokeStyle=p.color;ctx.lineWidth=8*(1-u);ctx.beginPath();ctx.arc(p.x,p.y,10+u*p.size,p.swirl?u*Math.PI*6:0,p.swirl?u*Math.PI*6+Math.PI*1.7:Math.PI*2);ctx.stroke();}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i],u=(now-p.start)/p.life;if(u>=1){particles.splice(i,1);continue;}const t=(now-p.start)/1000,x=p.x+p.vx*t,y=p.y+p.vy*t+130*t*t,r=p.size*(1-u*.65);ctx.globalAlpha=1-u;ctx.fillStyle=p.color;ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.closePath();ctx.fill();}
    ctx.globalAlpha=1;
  }
  function requestDraw(){if(!raf&&!document.hidden)raf=requestAnimationFrame(tick);}
  function nextFrame(now) {
    if(!queue.length){active=null;busy=false;view=clone(s);status();saveWin();populateLevels();if(s.phase!=='playing')audio.effect(s.phase==='won'?'finish':'over',{volume:.5});return;}
    const frame=queue.shift(),pace=Math.max(.5,1-Math.max(0,(frame.chain||1)-1)*.08),duration=(frame.kind==='clear'?240:frame.kind==='fall'?310:frame.kind==='rise'?420:180)*pace;
    const oldMap=new Map(view.board.map((tile,i)=>[tile?.uid,i]).filter(([uid])=>uid!=null));
    active={frame,start:now,duration,oldMap,removed:new Set(frame.removed||[])};
    if(frame.kind==='clear'){
      burst(frame,now);audio.effect(frame.triggered?.length?'merge':'clear',{rate:1+Math.min(5,frame.chain||0)*.055,volume:.58});
      if(frame.timeBonuses?.length){flash(`时间 +${frame.timeBonuses.length*5} 秒`);audio.effect('collect',{volume:.3});}
      else if(frame.tokens){flash(`星星奖励 +${frame.tokens*50}`);audio.effect('collect',{volume:.3});}
      else if(frame.multiplier>1)flash(`连击 ×${frame.multiplier}`);
      else if(frame.chain>=1)flash(`连锁 ×${frame.chain+1}`);
      else if(frame.triggered?.length)flash('超能爆破！');
      else if(frame.created?.length)flash(`合成${specials[frame.created[0].special]||'超能图块'}！`);
    }else if(frame.kind==='fall')audio.effect('drop',{volume:.16});
    else if(frame.kind==='rescue'){audio.effect('collect',{volume:.5});flash(id==='candyland'?'收集到果实！':'找到宝箱！');}
    status();
  }
  function tick(now) {
    raf=0;
    if(active&&now-active.start>=active.duration){view=active.frame;nextFrame(now);}
    draw(now);
    if(active||particles.length||rings.length||beams.length||drag?.moved)requestDraw();
  }
  function finishAnimation() {queue=[];active=null;busy=false;particles.length=rings.length=beams.length=0;view=clone(s);cancelAnimationFrame(raf);raf=0;status();draw();}
  function playFrames(frames) {
    selected=-1;hints=[];
    if(reduced.matches||document.hidden||!frames?.length){finishAnimation();saveWin();populateLevels();audio.effect(s.phase==='won'?'finish':'clear',{volume:.35});return;}
    queue=frames.map(frame=>clone(frame));busy=true;status();nextFrame(performance.now());requestDraw();
  }
  function flash(value){clearTimeout(messageTimer);text('board-message',value);messageTimer=setTimeout(()=>text('board-message',''),1100);}
  function act(a,b) {
    if(busy||paused||s.phase!=='playing'||$('dialog').open)return;
    const before=clone(s),result=C.play(s,a,b);
    if(!result.ok){
      say(({top:'只能移动最顶端、没有冰冻的小鸟。',column:'这一列放不下了，换一列试试。',blocked:'先解开锁链，再移动这块图块。',finished:'这一局已经结束，可以再来一次。',swap:'没有连成三个，图块回到原位。'})[result.reason]||'这次没有连起来，换个位置试试。');audio.effect('rotate',{volume:.18});selected=-1;hints=[];
      if(!bird&&Math.abs(a-b)===1&&Math.floor(a/7)===Math.floor(b/7)||!bird&&Math.abs(a-b)===7){
        const swap=clone(before);[swap.board[a],swap.board[b]]=[swap.board[b],swap.board[a]];
        playFrames([{...swap,kind:'swap'},{...before,kind:'swap'}]);
      }else{status();requestDraw();}return;
    }
    history.push(before);history=history.slice(-24);save();saveWin();
    say(s.phase==='won'?'完成啦！可以继续下一关。':bird?'选中最顶端的小鸟，再放到另一列顶部。':'组合特殊图块，可以触发更大的爆破。');
    playFrames(result.frames);audio.effect('move',{volume:.24});
  }
  function choose(i) {
    if(busy||paused||s.phase!=='playing')return;
    if(selected<0){
      if(bird&&(top(s.board,i%7)!==i||s.covers[i])){say('只能移动这一列最顶端、没有被冰冻的小鸟。');return;}
      if(!s.board[i])return;selected=i;hints=[];status();requestDraw();return;
    }
    if(selected===i){selected=-1;status();requestDraw();return;}
    if(bird||Math.abs(selected-i)===7||Math.floor(selected/7)===Math.floor(i/7)&&Math.abs(selected-i)===1)act(selected,i);
    else{selected=i;hints=[];status();requestDraw();}
  }
  $('cells').addEventListener('click',event=>{if(Date.now()<suppressClick||drag)return;const el=event.target.closest('[data-cell]');if(el)choose(Number(el.dataset.cell));});
  $('cells').addEventListener('pointerdown',event=>{
    if(drag||busy||paused||!event.isPrimary||event.button>0||s.phase!=='playing')return;
    const el=event.target.closest('[data-cell]');if(!el)return;const source=Number(el.dataset.cell);
    if(!s.board[source]||bird&&(top(s.board,source%7)!==source||s.covers[source]))return;
    const r=canvas.getBoundingClientRect();drag={pointer:event.pointerId,source,x:event.clientX,y:event.clientY,rect:r,moved:false,wx:(source%7+.5)*100,wy:(Math.floor(source/7)+.5)*100};
    // Synthetic accessibility/test events may have no active native pointer.
    try{el.setPointerCapture(event.pointerId);}catch{}
  });
  $('cells').addEventListener('pointermove',event=>{
    if(!drag||drag.pointer!==event.pointerId)return;
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<10&&!drag.moved)return;
    drag.moved=true;drag.wx=(event.clientX-drag.rect.x)/drag.rect.width*W;drag.wy=(event.clientY-drag.rect.y)/drag.rect.height*W;
    if(bird)for(let i=0;i<49;i++)cells[i].classList.toggle('drop-column',i%7===Math.floor(drag.wx/100));
    requestDraw();
  });
  $('cells').addEventListener('pointerup',event=>{
    if(!drag||drag.pointer!==event.pointerId)return;const p=drag;drag=null;cells.forEach(el=>el.classList.remove('drop-column'));
    if(!p.moved)return;suppressClick=Date.now()+400;
    const dx=event.clientX-p.x,dy=event.clientY-p.y;
    if(bird){const col=Math.floor((event.clientX-p.rect.x)/p.rect.width*7);if(col>=0&&col<7&&event.clientY>=p.rect.y&&event.clientY<=p.rect.bottom)act(p.source,col);else requestDraw();}
    else{const dest=p.source+(Math.abs(dx)>Math.abs(dy)?dx>0?1:-1:dy>0?7:-7);if(dest>=0&&dest<49&&(Math.abs(dest-p.source)===7||Math.floor(dest/7)===Math.floor(p.source/7)))act(p.source,dest);else requestDraw();}
  });
  function cancelDrag(event){if(!drag||event&&event.pointerId!==drag.pointer)return;drag=null;cells.forEach(el=>el.classList.remove('drop-column'));requestDraw();}
  for(const name of ['pointercancel','lostpointercapture'])$('cells').addEventListener(name,cancelDrag);
  $('cells').addEventListener('keydown',event=>{
    const el=event.target.closest('[data-cell]');if(!el)return;const i=Number(el.dataset.cell),step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
    if(step){event.preventDefault();const n=i+step;if(n>=0&&n<49&&(Math.abs(step)===7||Math.floor(n/7)===Math.floor(i/7))){cells[i].tabIndex=-1;cells[n].tabIndex=0;cells[n].focus();}}
    if(event.key==='Escape'){selected=-1;status();requestDraw();}
  });
  function ask(title,description,fn) {cancelDrag();finishAnimation();pending=fn;text('dialog-title',title);text('dialog-text',description);$('cancel').hidden=!fn;text('confirm',fn?'确定':'知道啦');$('dialog').showModal();audio.sync();}
  function reset(level=s.level,mode=s.mode) {cancelDrag();s=bird?C.fresh(id,level,undefined,mode):C.fresh(id,level);history=[];selected=-1;hints=[];paused=false;lastResult='';save();populateLevels();finishAnimation();say('准备好了就开始吧。');}
  $('hint').onclick=()=>{if(busy||paused)return;const move=C.hint(s);if(move){hints=move;selected=-1;say(bird?'亮起的小鸟可以移到提示列顶部。':'试着交换亮起的两个位置。');status();requestDraw();}else say('暂时没有可用的组合，可以点“换个排列”。');};
  $('shuffle').onclick=()=>{if(busy||paused)return;const before=clone(s),result=C.shuffle(s);if(result.ok){history.push(before);history=history.slice(-24);save();playFrames(result.frames);say('换好了排列，目标进度和特殊图块都保留。');}};
  $('undo').onclick=()=>{if(!history.length)return;cancelDrag();finishAnimation();s=history.pop();selected=-1;hints=[];lastResult='';save();finishAnimation();say('已回到上一步，可以换一种走法。');};
  if($('result-undo'))$('result-undo').onclick=()=>$('undo').onclick();
  $('restart').onclick=()=>ask('重新开始这一关？','本关会重新排列，已经完成的关卡记录会保留。',()=>reset());
  $('retry').onclick=()=>reset();$('next').onclick=()=>reset((s.level+1)%12);
  $('levels').onchange=event=>{const n=Number(event.target.value);event.target.value=s.level;if(n!==s.level)ask('切换关卡？','当前这一关会重新开始。',()=>reset(n));};
  if($('mode'))$('mode').onchange=event=>{const mode=event.target.value;event.target.value=s.mode;if(mode!==s.mode)ask(`进入${modeNames[mode]}？`,'当前这一局会重新开始。计时模式可以随时暂停，离开页面也会暂停。',()=>reset(s.level,mode));};
  $('pause').onclick=()=>{if(s.phase!=='playing')return;finishAnimation();paused=!paused;lastClock=performance.now();status();requestDraw();audio.sync();};
  $('help').onclick=()=>ask('怎么玩',bird?'只能移动各列最顶端的小鸟，拖到任意另一列顶部；也可以先点小鸟，再点目标列。上下左右连通的同色小鸟达到 3 只就爆破。4 / 5 / 6 / 7 只分别合成发光、燃火、闪电和黑旋风小鸟，再次与同色连通时释放超能力。\n慢慢练习没有倒计时；经典模式会从底部升起新行；潘多拉与狂热限时冲分；破冰模式要清除冰块。':id==='candyland'?'滑动交换相邻糖果，或依次点两个相邻位置。三只同色糖果连成直线才能消除，无效交换会弹回。四连合成条纹，T / L 形合成包装糖，直线五连合成彩色炸弹。包装糖会爆炸两次。两个特殊糖果交换，会触发强力组合。\n各关目标包括得分、果冻、收集果实和指定颜色。注意剩余步数；计时关也可以暂停。':'滑动交换相邻宝石，三颗同色连成直线就消除。锁链上的宝石不能交换或下落，要先通过匹配或爆破解锁。宝箱要靠消除下方宝石落到底部收集。四连、T / L 形、五连和特殊组合都能帮忙。\n随时可以看提示、换排列或撤销，没有体力和付费道具。',null);
  $('cancel').onclick=()=>{pending=null;$('dialog').close();};$('confirm').onclick=()=>{const fn=pending;pending=null;$('dialog').close();fn?.();};$('dialog').addEventListener('cancel',()=>{pending=null;});$('dialog').addEventListener('close',()=>{lastClock=performance.now();audio.sync();});
  $('sound').onclick=()=>{sound=audio.toggle();if(sound)audio.unlock(true);try{localStorage.setItem('childgame.sound',sound?'on':'off');}catch{}audio.sync();};
  function suspend(){cancelDrag();if(timed())paused=true;finishAnimation();save();audio.sync();lastClock=0;}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else{lastClock=performance.now();requestDraw();}});window.addEventListener('pagehide',suspend);
  reduced.addEventListener('change',()=>{if(reduced.matches)finishAnimation();});
  const resize=new ResizeObserver(()=>{const r=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),size=Math.max(1,Math.round(r.width*dpr));if(canvas.width!==size){canvas.width=canvas.height=size;ratio=size/W;}draw();requestDraw();});resize.observe(canvas);
  setInterval(()=>{
    const now=performance.now(),dt=lastClock?Math.min(.5,(now-lastClock)/1000):0;lastClock=now;
    if(document.hidden||paused||$('dialog').open||busy||drag||!timed())return;
    const before=clone(s),result=C.tick(s,dt);clockSave+=dt;
    if(result?.frames?.length){view=before;playFrames(result.frames);save();}
    else if(s.phase!==before.phase){save();saveWin();finishAnimation();audio.effect(s.phase==='won'?'finish':'over',{volume:.4});}
    else status();
    if(clockSave>=2){save();clockSave=0;}
  },200);
  window.MatchGame={snapshot:()=>clone(s),busy:()=>busy,paused:()=>paused,effects:()=>({particles:particles.length,rings:rings.length,beams:beams.length,sprites:sprites.size})};
  populateLevels();status();save();draw();requestDraw();say(paused?'欢迎回来，点“继续”恢复这一局。':bird?'拖动最顶端的小鸟，放到另一列顶部。':'交换相邻图块，试试特殊组合的威力。');
})();
