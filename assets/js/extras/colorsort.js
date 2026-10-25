(function (root) {
  'use strict';
  const ID = 'colorsort', CAP = 4, POUR_TIME = .94, LIFT_TIME = .16;
  const COLORS = ['#ec8391', '#64b9ce', '#eac166', '#94ba7d', '#aa91d0'];
  const INK = ['#973e55', '#286f8a', '#88631c', '#486e37', '#66508f'];
  const NAMES = ['草莓红', '天空蓝', '阳光黄', '树叶绿', '葡萄紫'];
  // Bottom to top. Fixed, independently solved layouts; every color has four units.
  // Two empty bottles remain available. Pars count whole contiguous-color pours.
  const LEVELS = [
    { par: 4, bottles: [[0,0,1,1],[1,0,0,1],[],[]] },
    { par: 5, bottles: [[1,0,1,1],[0,0,1,0],[],[]] },
    { par: 7, bottles: [[0,2,0,2],[2,0,0,1],[2,1,1,1],[],[]] },
    { par: 9, bottles: [[2,2,1,2],[0,1,0,2],[1,0,0,1],[],[]] },
    { par: 11, bottles: [[2,1,0,2],[0,1,0,2],[2,1,0,1],[],[]] },
    { par: 11, bottles: [[0,1,3,0],[3,0,2,3],[1,2,2,2],[3,1,1,0],[],[]] },
    { par: 13, bottles: [[3,1,2,3],[2,0,1,3],[1,2,3,0],[2,1,0,0],[],[]] },
    { par: 14, bottles: [[0,3,1,3],[1,2,0,2],[2,1,3,0],[0,1,3,2],[],[]] },
    { par: 16, bottles: [[3,0,4,1],[3,0,1,0],[4,1,2,4],[1,2,4,0],[3,2,2,3],[],[]] },
    { par: 18, bottles: [[4,1,2,4],[0,2,0,4],[3,2,0,1],[4,3,1,2],[3,1,3,0],[],[]] }
  ];
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const copy = bottles => bottles.map(b => b.slice());
  const complete = b => b.length === CAP && b.every(c => c === b[0]);
  const solved = bottles => bottles.every(b => !b.length || complete(b));
  function run(b) { let n = 0; while(n < b.length && b[b.length-1-n] === b[b.length-1]) n++; return n; }
  function amount(bottles, from, to) {
    if(!Number.isInteger(from)||!Number.isInteger(to)||from===to||!bottles[from]||!bottles[to])return 0;
    const a=bottles[from],b=bottles[to],n=run(a);
    return n && b.length+n<=CAP && (!b.length || b[b.length-1]===a[a.length-1]) ? n : 0;
  }
  function create(level=0, seed=1) {
    level=Number.isFinite(level)?clamp(Math.floor(level),0,9):0;seed>>>=0;
    return {v:1,id:ID,level,seed,rng:seed,phase:'playing',score:0,stars:0,moves:0,t:0,par:LEVELS[level].par,
      bottles:copy(LEVELS[level].bottles),selected:-1,focus:0,selectionAge:LIFT_TIME,anim:null,spark:null,
      note:'先选一瓶，再点另一瓶；相同颜色和图案可以合在一起。'};
  }
  function geometry(s,i) {
    const n=s.bottles.length,top=n<=4?n:4,row=n<=4?0:i<top?0:1,count=row?n-top:top,col=row?i-top:i;
    return {x:360+(col-(count-1)/2)*155,y:n<=4?554:row?714:407,h:216,w:100};
  }
  function center(s,i) { const p=geometry(s,i);return {x:p.x,y:p.y-102}; }
  function under(s,p) {
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return -1;
    for(let i=0;i<s.bottles.length;i++){const g=geometry(s,i);if(Math.abs(p.x-g.x)<=64&&p.y>=g.y-g.h-15&&p.y<=g.y+32)return i;}
    return -1;
  }
  function reject(s,text) {s.note=text;return {ok:false,events:[{type:'hit',message:text,count:3,x:360,y:134}]};}
  function choose(s,i) {
    if(!Number.isInteger(i)||!s.bottles[i])return {ok:false,events:[]};
    s.focus=i;
    if(s.selected===i){s.selected=-1;s.selectionAge=LIFT_TIME;s.note='已经放下了。选一瓶新的颜色吧。';return {ok:true,events:[]};}
    if(s.selected>=0)return pour(s,s.selected,i);
    if(!s.bottles[i].length)return reject(s,'这是空瓶。先选一瓶有颜色的，再倒进来。');
    s.selected=i;s.selectionAge=0;s.note=`已选 ${i+1} 号瓶：把最上面的${NAMES[s.bottles[i].at(-1)]}倒入同色或空瓶。`;
    return {ok:true,events:[{type:'move',...center(s,i)}]};
  }
  function pour(s,from,to) {
    if(!Number.isInteger(from)||!Number.isInteger(to)||!s.bottles[from]||!s.bottles[to])return {ok:false,events:[]};
    if(from===to)return reject(s,'选择另一只瓶子，颜色才有新家。');
    if(!s.bottles[from].length)return reject(s,'空瓶里还没有颜色，先选一瓶有颜色的。');
    const count=amount(s.bottles,from,to),a=s.bottles[from],b=s.bottles[to];
    if(!count)return reject(s,b.length===CAP?'这只瓶子已经满啦，换一个有空间的瓶子。':b.length&&b.at(-1)!==a.at(-1)?'瓶口颜色不同。只有相同颜色，或空瓶，才能接住。':'剩下的位置不够。这一整段相同颜色要一起倒入。');
    const color=a.at(-1);s.anim={from,to,color,count,source:a.slice(),target:b.slice(),t:0};
    if(s.spark?.id===from)s.spark=null;
    b.push(...a.splice(-count));s.moves++;s.selected=-1;s.selectionAge=LIFT_TIME;s.focus=to;
    s.note=`${from+1} 号瓶 → ${to+1} 号瓶，倒入 ${count} 格${NAMES[color]}。`;
    return {ok:true,events:[{type:'drop',...center(s,to),color:COLORS[color],count:4}]};
  }
  function act(s,type,p={}) {
    // Cancellation never changes liquid, including when a gesture ends off-board.
    if(type==='pointercancel')return {ok:false,events:[]};
    if(s.phase!=='playing'||s.anim)return {ok:false,events:[]};
    if(type==='pour')return pour(s,p.from,p.to);
    if(type==='bottle')return choose(s,p.index);
    if(type==='left'||type==='right'){s.focus=(s.focus+(type==='left'?-1:1)+s.bottles.length)%s.bottles.length;return {ok:true,events:[]};}
    if(type==='confirm')return choose(s,s.focus);
    if(type==='deselect'){s.selected=-1;s.selectionAge=LIFT_TIME;s.note='选好了再倒，慢慢想，不限时间。';return {ok:true,events:[]};}
    if(type==='pointerup'){
      const start=p.start||p,from=under(s,start),to=under(s,p),distance=Math.hypot(p.x-start.x,p.y-start.y);
      if(from<0)return {ok:false,events:[]};
      if(distance>18){if(to<0||to===from)return {ok:false,events:[]};return pour(s,from,to);}
      return to===from?choose(s,to):{ok:false,events:[]};
    }
    return {ok:false,events:[]};
  }
  function step(s,dt) {
    if(s.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return [];
    dt=Math.min(dt,.1);if(!needsFrame(s))return [];s.t+=dt;
    if(s.selected>=0)s.selectionAge=Math.min(LIFT_TIME,s.selectionAge+dt);
    if(s.spark){s.spark.t+=dt;if(s.spark.t>=.55)s.spark=null;}
    if(!s.anim)return [];
    const a=s.anim;a.t=Math.min(POUR_TIME,a.t+dt);if(a.t<POUR_TIME)return [];
    s.anim=null;const events=[];
    if(complete(s.bottles[a.to])){s.spark={id:a.to,t:0};events.push({type:'collect',...center(s,a.to),color:COLORS[a.color],count:12,label:'一瓶完成！'});}
    if(solved(s.bottles)){
      s.phase='won';s.spark=null;s.stars=s.moves<=s.par+2?3:s.moves<=s.par+6?2:1;
      s.score=Math.max(100,1200+s.level*100-Math.max(0,s.moves-s.par)*25);s.note='每一种颜色都找到了自己的瓶子！';
    }
    return events;
  }
  function needsFrame(s) { return s.phase==='playing'&&!!(s.anim||s.spark||s.selected>=0&&s.selectionAge<LIFT_TIME); }
  function solve(s,cap=60000) {
    const first=copy(s.bottles),key=bs=>bs.map(b=>b.join('')).sort().join('|'),queue=[first],previous=[-1],edges=[null],seen=new Set([key(first)]);
    for(let head=0;head<queue.length;head++){
      const bottles=queue[head];
      if(solved(bottles)){const path=[];for(let j=head;previous[j]>=0;j=previous[j])path.push(edges[j]);return path.reverse();}
      for(let from=0;from<bottles.length;from++){
        if(!bottles[from].length)continue;let triedEmpty=false;
        for(let to=0;to<bottles.length;to++){
          const n=amount(bottles,from,to);if(!n)continue;
          if(!bottles[to].length){if(triedEmpty||n===bottles[from].length)continue;triedEmpty=true;}
          const next=copy(bottles);next[to].push(...next[from].splice(-n));const k=key(next);
          if(seen.has(k))continue;if(queue.length>=cap)return null;
          seen.add(k);queue.push(next);previous.push(head);edges.push({from,to});
        }
      }
    }
    return null;
  }
  function hint(s) {
    if(s.anim)return {text:'先等这一瓶倒好，下一步就能继续了。'};
    const route=solve(s);
    if(route?.length){const m=route[0];return {text:`把 ${m.from+1} 号瓶最上面一段，倒进 ${m.to+1} 号瓶。瓶身数字能帮助你找到它们。`,targets:[center(s,m.from),center(s,m.to)]};}
    return {text:route?'颜色已经分好啦！':'暂时没有找到完整通路。试试撤销最近一步，给混色瓶留下一个空瓶。'};
  }
  function round(c,x,y,w,h,r,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
  function mark(c,color,x,y,size=7){
    c.save();c.translate(x,y);c.fillStyle=INK[color];c.strokeStyle=INK[color];c.lineWidth=2;c.beginPath();
    if(color===0)c.arc(0,0,size,0,Math.PI*2);
    else if(color===1){c.moveTo(0,-size-1);c.lineTo(size+1,size);c.lineTo(-size-1,size);c.closePath();}
    else if(color===2)c.rect(-size,-size,size*2,size*2);
    else if(color===3){c.moveTo(0,-size-2);c.lineTo(size+2,0);c.lineTo(0,size+2);c.lineTo(-size-2,0);c.closePath();}
    else{for(let j=0;j<10;j++){const a=-Math.PI/2+j*Math.PI/5,r=j%2?size*.45:size+2;j?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();}
    c.fill();c.restore();
  }
  function silhouette(c,h){c.beginPath();c.moveTo(-26,-h);c.lineTo(-26,-h+24);c.quadraticCurveTo(-48,-h+40,-48,-h+57);c.lineTo(-48,-18);c.quadraticCurveTo(-48,-3,-32,-3);c.lineTo(32,-3);c.quadraticCurveTo(48,-3,48,-18);c.lineTo(48,-h+57);c.quadraticCurveTo(48,-h+40,26,-h+24);c.lineTo(26,-h);c.closePath();}
  function drawBottle(c,s,i,layers,units,x,y,angle=0,selected=false,time=0){
    const h=216,unit=39;c.save();c.translate(x,y);c.rotate(angle);
    silhouette(c,h);c.fillStyle='#ffffffc9';c.fill();c.save();c.clip();
    for(let j=0;j<layers.length;j++){
      const fraction=clamp(units-j,0,1);if(!fraction)continue;const top=-10-(j+fraction)*unit,color=layers[j];
      c.fillStyle=COLORS[color];c.fillRect(-47,top,94,fraction*unit+1);
      c.fillStyle='#ffffff21';c.fillRect(-46,top,92,3);
      if(fraction>.55){mark(c,color,-11,-10-(j+.5)*unit,6);c.fillStyle=INK[color];c.font='bold 14px sans-serif';c.textAlign='center';c.fillText(String(color+1),12,-5-(j+.5)*unit);}
    }
    if(units>0){const yy=-10-units*unit;c.strokeStyle='#ffffff9c';c.lineWidth=3;c.beginPath();c.moveTo(-46,yy);c.quadraticCurveTo(0,yy+Math.sin(time*11)*2,46,yy);c.stroke();}
    c.restore();silhouette(c,h);c.strokeStyle=selected?'#e7ac50':'#9bb9bd';c.lineWidth=selected?4:3;c.stroke();
    c.strokeStyle='#ffffffc9';c.lineWidth=6;c.lineCap='round';c.beginPath();c.moveTo(-33,-h+63);c.lineTo(-33,-38);c.stroke();
    round(c,-31,-h-3,62,9,4,'#c2d7d7');round(c,-26,-h-2,52,3,2,'#fff');
    c.restore();
    const g=geometry(s,i);c.fillStyle='#547277';c.textAlign='center';c.font='bold 19px sans-serif';c.fillText(String(i+1),g.x,g.y+26);
    if(complete(s.bottles[i])&&(!s.anim||s.anim.to!==i)){c.fillStyle='#6a9c76';c.font='bold 21px sans-serif';c.fillText('✓',g.x+34,g.y+26);}
  }
  function background(c,single=false){
    c.fillStyle='#edf5ed';c.fillRect(0,0,720,800);c.fillStyle='#e2eee3';c.beginPath();c.ellipse(620,100,280,190,-.4,0,Math.PI*2);c.fill();
    round(c,26,22,668,106,24,'#fffdf5');c.fillStyle='#3e6365';c.font='bold 27px sans-serif';c.textAlign='left';c.fillText('把彩虹装进小瓶子',49,65);
    c.font='17px sans-serif';c.fillStyle='#78918b';c.fillText('同色接同色 · 空瓶来帮忙 · 一整段一起倒',49,101);
    for(const y of single?[574]:[424,731]){round(c,31,y,658,12,6,'#cfddce');round(c,41,y,638,4,2,'#ffffff80');}
    c.fillStyle='#78918b';c.font='17px sans-serif';c.textAlign='center';c.fillText('颜色 + 图案 + 数字，都能帮你分辨',360,781);
  }
  const ease=u=>u*u*(3-2*u);
  function draw(c,s,view={}){
    const single=s.bottles.length<=4;
    if(!root.ExtraRender?.layer(c,'colorsort:'+single,b=>background(b,single)))background(c,single);
    const a=s.anim,reduced=!!view.reduced,time=reduced?0:s.t;
    let moving=-1,pose=null,flow=0;
    if(a){
      const from=geometry(s,a.from),to=geometry(s,a.to),u=clamp(a.t/POUR_TIME,0,1),sign=from.x===to.x?(to.x<360?-1:1):Math.sign(to.x-from.x);
      flow=clamp((u-.22)/.56,0,1);const blend=u<.22?ease(u/.22):u>.78?1-ease((u-.78)/.22):1,angle=sign*1.04*blend;
      const end={x:to.x-sign*24-Math.sin(sign*1.04)*216,y:to.y-216-72+Math.cos(1.04)*216};
      moving=a.from;pose={x:from.x+(end.x-from.x)*blend,y:from.y+(end.y-from.y)*blend,angle:reduced?0:angle};
      if(reduced)pose={x:from.x,y:from.y,angle:0};
    }else if(view.pointer){
      const p=view.pointer,from=under(s,p.start);if(from>=0&&s.bottles[from].length&&Math.hypot(p.target.x-p.start.x,p.target.y-p.start.y)>18){
        const g=geometry(s,from);moving=from;pose={x:clamp(g.x+p.target.x-p.start.x,60,660),y:clamp(g.y+p.target.y-p.start.y-12,225,730),angle:reduced?0:clamp((p.target.x-p.start.x)*.001,-.13,.13)};
      }
    }
    for(let i=0;i<s.bottles.length;i++){
      const g=geometry(s,i);if(i===moving)continue;
      const selected=i===s.selected,lift=selected?(reduced?12:12*ease(clamp(s.selectionAge/LIFT_TIME,0,1))):0;
      let layers=s.bottles[i],units=layers.length;if(a&&i===a.to){layers=a.target.concat(Array(a.count).fill(a.color));units=a.target.length+a.count*flow;}
      if(selected){c.fillStyle='#e7be682b';c.beginPath();c.ellipse(g.x,g.y+3,60,13,0,0,Math.PI*2);c.fill();}
      drawBottle(c,s,i,layers,units,g.x,g.y-lift,0,selected,time);
      if(s.spark?.id===i&&!reduced){const u=s.spark.t/.55;c.strokeStyle='#e9b64e';c.globalAlpha=1-u;c.lineWidth=3;for(let j=0;j<8;j++){const angle=j*Math.PI/4;c.beginPath();c.moveTo(g.x+Math.cos(angle)*(45+u*15),g.y-108+Math.sin(angle)*(72+u*15));c.lineTo(g.x+Math.cos(angle)*(58+u*32),g.y-108+Math.sin(angle)*(85+u*32));c.stroke();}c.globalAlpha=1;}
    }
    if(moving>=0){
      const layers=a?a.source:s.bottles[moving],units=a?a.source.length-a.count*flow:layers.length;
      drawBottle(c,s,moving,layers,units,pose.x,pose.y,pose.angle,true,time);
      if(a&&flow>0&&flow<1){
        const target=geometry(s,a.to),sx=pose.x+Math.sin(pose.angle)*216,sy=pose.y-Math.cos(pose.angle)*216,tx=target.x,ty=target.y-12-(a.target.length+a.count*flow)*39;
        c.strokeStyle=COLORS[a.color];c.lineWidth=reduced?4:9;c.lineCap='round';c.beginPath();c.moveTo(sx,sy);c.bezierCurveTo(sx,sy-18,tx,sy-12,tx,ty);c.stroke();
        c.strokeStyle='#ffffff85';c.lineWidth=2;c.beginPath();c.moveTo(sx-2,sy);c.bezierCurveTo(sx-2,sy-18,tx-2,sy-12,tx-2,ty);c.stroke();
        if(!reduced){c.fillStyle=COLORS[a.color];for(let j=0;j<3;j++){const q=(time*3+j/3)%1;c.beginPath();c.arc(tx+Math.sin(j*3+time*8)*8,ty-18-q*16,2.5*(1-q),0,Math.PI*2);c.fill();}}
      }
    }
    if(single){c.fillStyle='#79968c';c.font='20px sans-serif';c.textAlign='center';c.fillText('留下空瓶，就有调整的空间',360,662);}
  }
  function hud(s){const count=s.bottles.filter(complete).length,colors=s.bottles.length-2;return {scoreLabel:'倒了几次',score:s.moves,statLabel:'已分好',stat:`${count} / ${colors}`,goal:'每种颜色装满一瓶，剩下两只空瓶',progress:count/colors,message:s.note};}
  function controls(s){return [{id:'left',label:'上一瓶',disabled:!!s.anim},{id:'right',label:'下一瓶',disabled:!!s.anim},{id:'confirm',label:s.selected<0?`选 ${s.focus+1} 号瓶`:s.selected===s.focus?'放下这瓶':`倒入 ${s.focus+1} 号`,disabled:!!s.anim},{id:'deselect',label:'取消选中',disabled:s.selected<0||!!s.anim}];}
  function validate(s){
    const nat=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max,finite=(v,max)=>Number.isFinite(v)&&v>=0&&v<=max;
    if(!s||s.v!==1||s.id!==ID||!nat(s.level,9)||!nat(s.seed,4294967295)||!nat(s.rng,4294967295)||!['playing','won'].includes(s.phase)||!nat(s.moves,100000)||!nat(s.score,1000000)||!nat(s.stars,3)||!finite(s.t,1000000)||s.par!==LEVELS[s.level].par)return false;
    const n=LEVELS[s.level].bottles.length,colors=n-2,validBottle=b=>Array.isArray(b)&&b.length<=CAP&&b.every(c=>nat(c,colors-1));
    if(!Array.isArray(s.bottles)||s.bottles.length!==n||!s.bottles.every(validBottle)||!Number.isInteger(s.selected)||s.selected< -1||s.selected>=n||!nat(s.focus,n-1)||!finite(s.selectionAge,LIFT_TIME)||typeof s.note!=='string'||s.note.length>200)return false;
    const counts=Array(colors).fill(0);for(const b of s.bottles)for(const color of b)counts[color]++;if(counts.some(c=>c!==CAP))return false;
    if(s.selected>=0&&!s.bottles[s.selected].length)return false;
    if(s.spark!==null&&(!s.spark||!nat(s.spark.id,n-1)||!finite(s.spark.t,.55)||!complete(s.bottles[s.spark.id])))return false;
    if(s.anim!==null){
      const a=s.anim;if(!a||!nat(a.from,n-1)||!nat(a.to,n-1)||a.from===a.to||!nat(a.color,colors-1)||!nat(a.count,CAP)||!a.count||!finite(a.t,POUR_TIME)||!validBottle(a.source)||!validBottle(a.target)||s.selected!==-1)return false;
      const before=copy(s.bottles);before[a.from]=a.source;before[a.to]=a.target;
      if(amount(before,a.from,a.to)!==a.count||a.source.at(-1)!==a.color)return false;
      const afterSource=a.source.slice(0,-a.count),afterTarget=a.target.concat(Array(a.count).fill(a.color));
      if(afterSource.join(',')!==s.bottles[a.from].join(',')||afterTarget.join(',')!==s.bottles[a.to].join(','))return false;
    }
    if(s.phase==='won')return solved(s.bottles)&&s.anim===null&&s.spark===null&&s.moves>=s.par&&s.stars===(s.moves<=s.par+2?3:s.moves<=s.par+6?2:1)&&s.score===Math.max(100,1200+s.level*100-Math.max(0,s.moves-s.par)*25);
    return s.score===0&&s.stars===0&&(!solved(s.bottles)||s.anim!==null);
  }
  const G={id:ID,meta:{title:'彩虹分装师',category:'解谜',blurb:'抬起小瓶，让同色水流相遇，把彩虹一瓶瓶分好。',tags:['颜色分类','逻辑规划','轻松'],color:'#6faa9d',instructions:'每瓶能装 4 格。先点有颜色的瓶子，再点目标瓶；也可以从一只瓶子拖到另一只。最上方连续相同颜色会整段倒出，只能倒入顶部同色或空瓶，空间不够时不会倒水。每种颜色装满一瓶即可过关。图案和数字也能区分颜色。没有倒计时，可提示、撤销和暂停；拖出瓶子再松手不会倒水。'},levels:10,create,act,step,draw,hud,controls,hint,validate,needsFrame,solve,center,geometry,under,amount,complete};
  if(typeof module!=='undefined'&&module.exports)module.exports=G;else(root.ExtraGames||(root.ExtraGames={}))[ID]=G;
})(typeof window!=='undefined'?window:globalThis);
