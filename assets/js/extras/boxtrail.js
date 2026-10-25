(function(root){
  'use strict';
  const ID='boxtrail',DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]},NAMES={up:'上',down:'下',left:'左',right:'右'};
  const MAPS=[
    ['#######','#     #','# @$ .#','#     #','#######'],
    ['#######','#     #','#  $ .#','# @   #','#######'],
    ['#######','# .   #','# $   #','#  @  #','#   $.#','#######'],
    ['#######','# . . #','# $ $ #','#  #  #','# @   #','#######'],
    ['########','# .  . #','# $  $ #','#   #  #','#  $ . #','# @    #','########'],
    ['########','# .  . #','# $  $ #','#  ##  #','# . $  #','#   @  #','########'],
    ['########','#  .   #','#  $   #','# ##   #','#  $ . #','# @    #','########'],
    ['########','# . .  #','#  $$  #','# #  . #','#  $   #','#   @  #','########'],
    ['########','# . .  #','# $ $  #','#   #. #','#  $   #','# @    #','########'],
    ['########','#. . . #','# # # ##','#$ $ $ #','#  $  .#','# @    #','########']
  ];
  const boards=MAPS.map(rows=>{const w=rows[0].length,h=rows.length,walls=[],goals=[],boxes=[];let player=0;rows.forEach((row,y)=>[...row].forEach((v,x)=>{const i=y*w+x;if(v==='#')walls.push(i);if(v==='.')goals.push(i);if(v==='$')boxes.push(i);if(v==='@')player=i;}));const floor=new Set(Array.from({length:w*h},(_,i)=>i).filter(i=>!walls.includes(i))),safe=new Set(goals),queue=goals.slice();for(let k=0;k<queue.length;k++)for(const [dx,dy]of Object.values(DIRS)){const a=queue[k]-dx-dy*w,b=a-dx-dy*w;if(floor.has(a)&&floor.has(b)&&!safe.has(a)){safe.add(a);queue.push(a);}}return{w,h,walls,goals,boxes,player,floor,safe};});
  const anims=new WeakMap(),gestures=new WeakMap(),pars=new Map();
  const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  function layout(level){const b=boards[level],cell=Math.min(78,600/b.w,550/b.h);return{x:(720-b.w*cell)/2,y:165+(550-b.h*cell)/2,cell,w:b.w,h:b.h};}
  function center(s,cell){const a=layout(s.level);return{x:a.x+(cell%a.w+.5)*a.cell,y:a.y+(Math.floor(cell/a.w)+.5)*a.cell};}
  function transition(b,p,boxes,dir){const d=DIRS[dir];if(!d)return null;const next=p+d[0]+d[1]*b.w;if(!b.floor.has(next))return null;const k=boxes.indexOf(next);if(k<0)return{p:next,boxes:boxes.slice(),pushed:-1};const into=next+d[0]+d[1]*b.w;if(!b.floor.has(into)||boxes.includes(into))return null;const out=boxes.slice();out[k]=into;return{p:next,boxes:out,pushed:k};}
  function solved(b,boxes){return boxes.every(i=>b.goals.includes(i));}
  function solve(s,cap=45000){
    const b=boards[s.level];if(!b||s.boxes.some(i=>!b.safe.has(i)))return null;
    const queue=[{p:s.p,boxes:s.boxes.slice(),prev:-1,dirs:[]}],seen=new Set();
    for(let head=0;head<queue.length&&queue.length<=cap;head++){
      const a=queue[head];if(solved(b,a.boxes)){let route=[];for(let k=head;queue[k].prev!==-1;k=queue[k].prev)route=queue[k].dirs.concat(route);return route;}
      const occupied=new Set(a.boxes),walk=new Map([[a.p,[]]]),front=[a.p];for(let k=0;k<front.length;k++)for(const [dir,[dx,dy]]of Object.entries(DIRS)){const n=front[k]+dx+dy*b.w;if(b.floor.has(n)&&!occupied.has(n)&&!walk.has(n)){walk.set(n,walk.get(front[k]).concat(dir));front.push(n);}}
      const key=a.boxes.slice().sort((x,y)=>x-y).join(',')+'|'+Math.min(...front);if(seen.has(key))continue;seen.add(key);
      for(let k=0;k<a.boxes.length;k++)for(const [dir,[dx,dy]]of Object.entries(DIRS)){const d=dx+dy*b.w,from=a.boxes[k]-d,to=a.boxes[k]+d;if(!walk.has(from)||!b.safe.has(to)||occupied.has(to))continue;const boxes=a.boxes.slice();boxes[k]=to;queue.push({p:a.boxes[k],boxes,prev:head,dirs:walk.get(from).concat(dir)});}
    }return null;
  }
  function create(level=0,seed=1){level=Math.max(0,Math.min(9,Math.floor(level)));seed>>>=0;const b=boards[level],s={v:1,id:ID,level,seed,rng:seed,phase:'playing',score:0,stars:0,moves:0,t:0,p:b.player,boxes:b.boxes.slice(),route:[]};if(!pars.has(level))pars.set(level,solve(s)?.length||1);return s;}
  function dead(s){const b=boards[s.level];return s.boxes.filter(i=>!b.safe.has(i));}
  function result(s){const b=boards[s.level];s.moves=s.route.length;if(solved(b,s.boxes)){s.phase='won';s.stars=s.moves<=(pars.get(s.level)||1)+3?3:s.moves<=(pars.get(s.level)||1)*2+8?2:1;s.score=Math.max(100,1200+s.level*100-s.moves*5);}else{s.phase='playing';s.stars=0;s.score=0;}}
  function move(s,dir){const b=boards[s.level],n=transition(b,s.p,s.boxes,dir);if(!n)return{ok:false,events:[{type:'hit',...center(s,s.p),message:'这里过不去，箱子只能向前推，不能拉。',count:3}]};if(s.route.length>=4000)return{ok:false,events:[]};anims.set(s,{p:s.p,boxes:s.boxes.slice(),age:0,pushed:n.pushed});s.p=n.p;s.boxes=n.boxes;s.route.push(dir);result(s);const p=center(s,n.pushed<0?s.p:s.boxes[n.pushed]),onGoal=n.pushed>=0&&b.goals.includes(s.boxes[n.pushed]);const events=[{type:onGoal?'collect':n.pushed<0?'move':'drop',...p,color:onGoal?'#f2c85b':'#bf915e',label:onGoal?'到家啦！':undefined}];if(dead(s).length)events.push({type:'hit',...p,message:'箱子进了无法到达目标的死角，点「退一步」就能救回来。'});if(s.phase==='won')events.push({type:'clear',...p,color:'#f2c85b',label:'全部送到！'});return{ok:true,events};}
  function rewind(s){if(!s.route.length)return{ok:false,events:[]};const route=s.route.slice(0,-1),b=boards[s.level];let p=b.player,boxes=b.boxes.slice();for(const d of route){const n=transition(b,p,boxes,d);p=n.p;boxes=n.boxes;}anims.set(s,{p:s.p,boxes:s.boxes.slice(),age:0,pushed:-1});s.p=p;s.boxes=boxes;s.route=route;result(s);return{ok:true,events:[{type:'rotate',...center(s,p)}]};}
  function act(s,type,p={}){
    if(type==='pointercancel'){gestures.delete(s);return{ok:false,events:[]};}
    if(s.phase!=='playing')return{ok:false,events:[]};
    if(type==='back')return rewind(s);if(DIRS[type])return move(s,type);
    if(type==='pointerdown'){gestures.set(s,{x:p.x,y:p.y});return{ok:false,events:[]};}
    if(type==='pointerup'){
      const start=gestures.get(s)||p.start||p;gestures.delete(s);if(![p.x,p.y,start.x,start.y].every(Number.isFinite))return{ok:false,events:[]};const dx=p.x-start.x,dy=p.y-start.y;
      if(Math.hypot(dx,dy)>=24)return move(s,Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');
      const a=layout(s.level),x=Math.floor((p.x-a.x)/a.cell),y=Math.floor((p.y-a.y)/a.cell),px=s.p%a.w,py=Math.floor(s.p/a.w);
      if(Math.abs(x-px)+Math.abs(y-py)===1)return move(s,x>px?'right':x<px?'left':y>py?'down':'up');
    }return{ok:false,events:[]};
  }
  function step(s,dt){if(s.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return[];dt=Math.min(.1,dt);s.t+=dt;const a=anims.get(s);if(a){a.age+=dt;if(a.age>=.22)anims.delete(s);}return[];}
  function needsFrame(s){return anims.has(s);}
  function round(c,x,y,w,h,r,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
  function star(c,x,y,r,color){c.fillStyle=color;c.beginPath();for(let i=0;i<10;i++){const t=i*Math.PI/5-Math.PI/2,d=i%2?r*.45:r;i?c.lineTo(x+Math.cos(t)*d,y+Math.sin(t)*d):c.moveTo(x+Math.cos(t)*d,y+Math.sin(t)*d);}c.closePath();c.fill();}
  function background(c,level){const a=layout(level),b=boards[level],g=c.createLinearGradient(0,0,0,800);g.addColorStop(0,'#e9f3da');g.addColorStop(1,'#b6d5bd');c.fillStyle=g;c.fillRect(0,0,720,800);for(let i=0;i<16;i++){const x=(i*167+31)%720,y=150+(i*109)%640;c.fillStyle=i%2?'#87b98b40':'#ffffff60';c.beginPath();c.ellipse(x,y,18,6,i,0,Math.PI*2);c.fill();}round(c,32,27,656,103,26,'#fffdf1');c.fillStyle='#405d43';c.font='bold 28px sans-serif';c.textAlign='left';c.fillText('小熊的森林搬家日',56,69);c.font='18px sans-serif';c.fillStyle='#748769';c.fillText('把每个蜂蜜箱，推到闪亮的星星地垫上',56,103);round(c,a.x-8,a.y+9,a.w*a.cell+16,a.h*a.cell+16,18,'#63826955');round(c,a.x-8,a.y-8,a.w*a.cell+16,a.h*a.cell+16,18,'#739676');for(let i=0;i<b.w*b.h;i++){const x=a.x+i%b.w*a.cell,y=a.y+Math.floor(i/b.w)*a.cell;if(b.walls.includes(i)){round(c,x+2,y+6,a.cell-4,a.cell-5,11,'#71936c');round(c,x+2,y+1,a.cell-4,a.cell-10,11,'#97ba82');round(c,x+8,y+6,a.cell-16,8,4,'#bad49a');}else{round(c,x+2,y+2,a.cell-4,a.cell-4,8,(i+Math.floor(i/b.w))%2?'#e7dfb6':'#f0e7c8');if(b.goals.includes(i)){const p=center({level},i);c.fillStyle='#efca6760';c.beginPath();c.arc(p.x,p.y,a.cell*.35,0,Math.PI*2);c.fill();star(c,p.x,p.y,a.cell*.24,'#d5aa43');}}}c.textAlign='center';c.fillStyle='#4e6f58';c.font='18px sans-serif';c.fillText('滑动一下走一格 · 也可以点小熊旁边的格子',360,765);}
  function bear(c,x,y,size){c.save();c.translate(x,y);const r=size*.28;c.fillStyle='#5c47362b';c.beginPath();c.ellipse(0,r*.8,r*1.15,r*.45,0,0,Math.PI*2);c.fill();for(const dx of[-.7,.7]){c.fillStyle='#966846';c.beginPath();c.arc(dx*r,-r*.65,r*.43,0,Math.PI*2);c.fill();c.fillStyle='#e9b781';c.beginPath();c.arc(dx*r,-r*.65,r*.24,0,Math.PI*2);c.fill();}round(c,-r,-r*.72,r*2,r*1.8,r*.65,'#b77f4d');round(c,-r*.63,-r*.08,r*1.26,r*.95,r*.45,'#f3d19a');for(const dx of[-.4,.4]){c.fillStyle='#342f28';c.beginPath();c.arc(dx*r,-r*.12,r*.09,0,Math.PI*2);c.fill();}c.fillStyle='#694b36';c.beginPath();c.ellipse(0,r*.24,r*.17,r*.12,0,0,Math.PI*2);c.fill();round(c,-r*.85,r*.63,r*1.7,r*.32,r*.1,'#ef8c6b');c.restore();}
  function draw(c,s,view={}){const b=boards[s.level],a=layout(s.level);if(!root.ExtraRender?.layer(c,ID+':'+s.level,q=>background(q,s.level)))background(c,s.level);const anim=anims.get(s);if(anim&&s.phase==='won'){anim.age=Math.min(.22,anim.age+(view.dt||0));if(anim.age>=.22||view.reduced)anims.delete(s);}const u=view.reduced||!anim?1:1-Math.pow(1-Math.min(1,anim.age/.16),3),point=(cell,old)=>{const p=center(s,cell),q=center(s,old??cell);return{x:q.x+(p.x-q.x)*u,y:q.y+(p.y-q.y)*u};};const stuck=dead(s);s.boxes.forEach((cell,i)=>{const p=point(cell,anim?.boxes[i]),r=a.cell*.38,ready=b.goals.includes(cell);round(c,p.x-r,p.y-r+6,r*2,r*2,10,'#60482730');round(c,p.x-r,p.y-r,r*2,r*2,10,ready?'#d4ae53':'#c08a51');round(c,p.x-r+5,p.y-r+5,r*2-10,r*2-10,7,ready?'#f0d884':'#e8b474');c.strokeStyle=ready?'#c39b41':'#b27e4c';c.lineWidth=4;c.strokeRect(p.x-r+10,p.y-r+10,r*2-20,r*2-20);star(c,p.x,p.y,r*.43,ready?'#fff9c6':'#fff0c6');if(stuck.includes(cell)){c.strokeStyle='#cb675e';c.lineWidth=4;c.beginPath();c.roundRect(p.x-r-3,p.y-r-3,r*2+6,r*2+6,12);c.stroke();}});const p=point(s.p,anim?.p);bear(c,p.x,p.y,a.cell);}
  function hud(s){const b=boards[s.level],done=s.boxes.filter(i=>b.goals.includes(i)).length;return{scoreLabel:'走了几步',score:s.moves,statLabel:'送到目标',stat:done+'/'+b.goals.length,goal:'把全部蜂蜜箱推到星星地垫',progress:done/b.goals.length,message:dead(s).length?'有箱子进了死角！点「退一步」恢复。':'滑动走一格，点相邻格也可以；箱子只能推，不能拉。'};}
  function controls(s){return[{id:'up',label:'↑ 向上'},{id:'left',label:'← 向左'},{id:'down',label:'↓ 向下'},{id:'right',label:'→ 向右'},{id:'back',label:'↶ 退一步',disabled:!s.route.length}];}
  function hint(s){const route=solve(s);if(!route){const stuck=dead(s);return{text:stuck.length?'箱子进了死角。先点「退一步」，让箱子离开红框位置。':'暂时没找到后续路线。可以先退一步，换个方向再推。',targets:stuck.map(i=>center(s,i)),action:['back',{}]};}if(!route.length)return{text:'蜂蜜箱全部到家啦！'};const d=DIRS[route[0]];return{text:'小熊先向'+NAMES[route[0]]+'走一格。',targets:[center(s,s.p+d[0]+d[1]*boards[s.level].w)],action:[route[0],{}]};}
  function validate(s){const nat=(x,m)=>Number.isInteger(x)&&x>=0&&x<=m;if(!s||s.v!==1||s.id!==ID||!nat(s.level,9)||!nat(s.seed,4294967295)||s.rng!==s.seed||!['playing','won'].includes(s.phase)||!nat(s.moves,4000)||!nat(s.score,3000)||!nat(s.stars,3)||!Number.isFinite(s.t)||s.t<0||s.t>1000000||!Array.isArray(s.route)||s.route.length!==s.moves||!Array.isArray(s.boxes))return false;const b=boards[s.level];let p=b.player,boxes=b.boxes.slice();for(let k=0;k<s.route.length;k++){if(solved(b,boxes))return false;const n=transition(b,p,boxes,s.route[k]);if(!n)return false;p=n.p;boxes=n.boxes;}if(s.p!==p||!same(s.boxes,boxes))return false;if(!pars.has(s.level))create(s.level);const copy={...s};result(copy);return copy.phase===s.phase&&copy.stars===s.stars&&copy.score===s.score;}
  const G={id:ID,levels:10,meta:{title:'小熊推箱子',category:'解谜',blurb:'滑动小熊，把蜂蜜箱推到星星地垫，想好方向再出发。',tags:['推箱子','空间思维','滑动'],color:'#93b87b',instructions:['滑动屏幕方向，小熊就走一格；也可点相邻格或方向按钮。','箱子只能往前推，不能拉，也不能穿墙或推两个箱子。把全部箱子送到星星地垫即过关。','红框表示箱子进入了无法到达目标的死角，点「退一步」可以撤销。提示会指出真实可行路线的下一步。']},create,act,step,draw,hud,controls,hint,validate,needsFrame,solve,layout,center,dead,boards};
  if(typeof module!=='undefined'&&module.exports)module.exports=G;else(root.ExtraGames||(root.ExtraGames={}))[ID]=G;
})(typeof window!=='undefined'?window:globalThis);
