(function(root){
  'use strict';
  const ID='starpath',TAU=Math.PI*2,HIT=49;
  const ring=n=>Array.from({length:n},(_,i)=>[360+Math.cos(i*TAU/n-Math.PI/2)*230,400+Math.sin(i*TAU/n-Math.PI/2)*230]);
  const petals=n=>({nodes:[...ring(n),[360,400]],edges:Array.from({length:n/2},(_,i)=>[[n,2*i],[2*i,2*i+1],[2*i+1,n]]).flat()});
  const wheel=full=>({nodes:[...ring(8),[360,400]],edges:[...Array.from({length:8},(_,i)=>[i,(i+1)%8]),...(full?[0,1,2,3,4,5,6,7]:[0,2,4,6]).map(i=>[8,i]),...(full?[[0,2],[1,3],[4,6],[5,7]]:[[0,2],[4,6]])]});
  const GRAPHS=[
    {name:'星星散步',nodes:[[140,240],[300,310],[460,440],[580,600]],edges:[[0,1],[1,2],[2,3]]},
    {name:'三角帆船',nodes:[[360,200],[160,580],[560,580]],edges:[[0,1],[1,2],[2,0]]},
    {name:'月光方窗',nodes:[[180,240],[540,240],[540,600],[180,600]],edges:[[0,1],[1,2],[2,3],[3,0]]},
    {name:'寄给月亮的信',nodes:[[180,240],[540,240],[540,600],[180,600]],edges:[[0,1],[1,2],[2,3],[3,0],[0,2]]},
    {name:'星空小屋',nodes:[[360,175],[180,340],[540,340],[540,620],[180,620]],edges:[[0,1],[0,2],[1,2],[1,4],[4,3],[3,2]]},
    {name:'双生风筝',nodes:[[360,400],[180,280],[360,175],[540,280],[540,520],[360,625],[180,520]],edges:[[0,1],[1,2],[2,3],[3,0],[0,4],[4,5],[5,6],[6,0]]},
    {name:'三叶星草',...petals(6)},
    {name:'四瓣星花',...petals(8)},
    {name:'月夜万花筒',...wheel(false)},
    {name:'银河摩天轮',...wheel(true)}
  ];
  const gestures=new WeakMap(),anims=new WeakMap();
  const edgeKey=(a,b)=>a<b?a+':'+b:b+':'+a;
  const allEdges=GRAPHS.map(g=>new Set(g.edges.map(([a,b])=>edgeKey(a,b))));
  const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  function create(level=0,seed=1){level=Math.max(0,Math.min(9,Math.floor(level)));seed>>>=0;return{v:1,id:ID,level,seed,rng:seed,phase:'playing',score:0,stars:0,moves:0,t:0,path:[]};}
  function nodePoint(s,node){const p=GRAPHS[s.level].nodes[node];return p?{x:p[0],y:p[1]}:null;}
  function used(path){return new Set(path.slice(1).map((n,i)=>edgeKey(path[i],n)));}
  function solve(s){
    const g=GRAPHS[s.level];if(!g)return null;const drawn=used(s.path),edges=g.edges.filter(([a,b])=>!drawn.has(edgeKey(a,b)));if(!edges.length)return[];
    const adj=g.nodes.map(()=>[]);edges.forEach(([a,b],i)=>{adj[a].push([b,i]);adj[b].push([a,i]);});const odds=adj.map((a,i)=>a.length%2?i:-1).filter(i=>i>=0),start=s.path.length?s.path[s.path.length-1]:odds[0]??adj.findIndex(a=>a.length);
    if(odds.length!==0&&odds.length!==2||odds.length===2&&!odds.includes(start)||!adj[start]?.length)return null;
    const taken=new Set(),stack=[start],out=[];
    while(stack.length){const n=stack[stack.length-1],next=adj[n].find(([,e])=>!taken.has(e));if(next){taken.add(next[1]);stack.push(next[0]);}else out.push(stack.pop());}
    if(taken.size!==edges.length)return null;out.reverse();return s.path.length?out.slice(1):out;
  }
  function update(s){s.moves=s.path.length;const complete=s.path.length===GRAPHS[s.level].edges.length+1;s.phase=complete?'won':'playing';s.stars=complete?3:0;s.score=complete?800+s.level*100+GRAPHS[s.level].edges.length*40:0;}
  function choose(s,path,node){
    const g=GRAPHS[s.level];if(!Number.isInteger(node)||!g.nodes[node])return{ok:false,events:[]};const p=nodePoint(s,node),last=path[path.length-1];if(last===node)return{ok:false,events:[]};
    if(path.length>1&&node===path[path.length-2]){path.pop();anims.set(s,{age:0,from:last,to:node,back:true});return{ok:true,events:[{type:'rotate',...p,color:'#aac8fa',message:'退回一条线，可以换条路继续。'}]};}
    if(path.length&&(!allEdges[s.level].has(edgeKey(last,node))||used(path).has(edgeKey(last,node))))return{ok:false,events:[{type:'hit',...p,message:'沿着虚线连相邻星星；每条线只能走一次。',count:3}]};
    path.push(node);anims.set(s,{age:0,from:last??node,to:node,back:false});return{ok:true,events:[{type:path.length===1?'move':'collect',...p,color:'#ffe090',rate:1+Math.min(.45,path.length*.025),count:5}]};
  }
  function under(s,p){if(!p||![p.x,p.y].every(Number.isFinite))return-1;let best=-1,d=HIT*HIT;GRAPHS[s.level].nodes.forEach(([x,y],i)=>{const q=(p.x-x)**2+(p.y-y)**2;if(q<d){d=q;best=i;}});return best;}
  function segment(s,a,b,path){
    if(!a||!b||![a.x,a.y,b.x,b.y].every(Number.isFinite))return[];const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy,hits=[];
    GRAPHS[s.level].nodes.forEach(([x,y],node)=>{const t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/length)):0,d=(a.x+t*dx-x)**2+(a.y+t*dy-y)**2;if(d<HIT*HIT)hits.push({node,t});});hits.sort((u,v)=>u.t-v.t);
    const events=[];for(const hit of hits){if(hit.t<.001&&hit.node===path[path.length-1])continue;const r=choose(s,path,hit.node);events.push(...r.events);}return events;
  }
  function act(s,type,p={}){
    if(type==='pointercancel'){if(gestures.has(s)){gestures.delete(s);anims.delete(s);}return{ok:false,events:[]};}
    if(s.phase!=='playing')return{ok:false,events:[]};
    if(type==='visit'){const r=choose(s,s.path,p.node);if(r.ok)update(s);return r;}
    if(type==='back'){if(!s.path.length)return{ok:false,events:[]};const old=s.path.pop();update(s);gestures.delete(s);anims.set(s,{age:0,from:old,to:s.path[s.path.length-1]??old,back:true});return{ok:true,events:[{type:'rotate',...nodePoint(s,old)}]};}
    if(type==='clear'){if(!s.path.length)return{ok:false,events:[]};s.path=[];update(s);gestures.delete(s);anims.delete(s);return{ok:true,events:[{type:'rotate',message:'重新选一颗起点星星吧。'}]};}
    if(type==='pointerdown'){if(![p.x,p.y].every(Number.isFinite))return{ok:false,events:[]};const path=s.path.slice(),node=under(s,p),events=node<0?[]:choose(s,path,node).events;gestures.set(s,{path,last:{x:p.x,y:p.y}});return{ok:false,events};}
    if(type==='pointermove'){const g=gestures.get(s);if(!g||![p.x,p.y].every(Number.isFinite))return{ok:false,events:[]};const events=segment(s,g.last,p,g.path);g.last={x:p.x,y:p.y};return{ok:false,events};}
    if(type==='pointerup'){
      let g=gestures.get(s);if(!g){g={path:s.path.slice(),last:p.start||p};const node=under(s,g.last);if(node>=0)choose(s,g.path,node);}
      const events=segment(s,g.last,p,g.path);gestures.delete(s);if(same(g.path,s.path))return{ok:false,events};s.path=g.path;update(s);if(s.phase==='won')events.push({type:'clear',...nodePoint(s,s.path[s.path.length-1]),color:'#ffe090',label:'星座点亮了！'});return{ok:true,events};
    }return{ok:false,events:[]};
  }
  function step(s,dt){if(s.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return[];dt=Math.min(.1,dt);s.t+=dt;const a=anims.get(s);if(a){a.age+=dt;if(a.age>.48)anims.delete(s);}return[];}
  function needsFrame(s){return anims.has(s);}
  function round(c,x,y,w,h,r,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
  function star(c,x,y,r,color){c.fillStyle=color;c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.45:r;i?c.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d):c.moveTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}c.closePath();c.fill();}
  function background(c,level){const g=c.createLinearGradient(0,0,720,800);g.addColorStop(0,'#1c294e');g.addColorStop(.6,'#384368');g.addColorStop(1,'#665176');c.fillStyle=g;c.fillRect(0,0,720,800);for(let i=0;i<65;i++){c.fillStyle=i%4?'#f4e3cb45':'#fff5d78c';const x=(i*137+49)%700+10,y=(i*179+11)%780+10;c.beginPath();c.arc(x,y,i%5===0?2:1,0,TAU);c.fill();}round(c,30,26,660,98,25,'#ffffff12');c.fillStyle='#fff3c3';c.font='bold 28px sans-serif';c.textAlign='left';c.fillText(GRAPHS[level].name,55,68);c.font='18px sans-serif';c.fillStyle='#c3d2ed';c.fillText('一笔走过每条星光路，让整个星座亮起来',55,103);c.lineWidth=4;c.strokeStyle='#c1cce34f';c.lineCap='round';c.setLineDash([8,12]);for(const[a,b]of GRAPHS[level].edges){const u=GRAPHS[level].nodes[a],v=GRAPHS[level].nodes[b];c.beginPath();c.moveTo(...u);c.lineTo(...v);c.stroke();}c.setLineDash([]);c.fillStyle='#d5d9eb';c.font='18px sans-serif';c.textAlign='center';c.fillText('逐颗点星星，或一笔拖动 · 交叉处不算节点',360,760);}
  function draw(c,s,view={}){
    if(!root.ExtraRender?.layer(c,ID+':'+s.level,q=>background(q,s.level)))background(c,s.level);const g=GRAPHS[s.level],gesture=gestures.get(s),path=gesture?.path||s.path,a=anims.get(s);if(a&&s.phase==='won'){a.age=Math.min(.5,a.age+(view.dt||0));if(a.age>=.48||view.reduced)anims.delete(s);}const last=path[path.length-1],lit=new Set(path),shownEdges=used(path);
    c.lineCap='round';c.lineJoin='round';for(const[u,v]of g.edges){if(!shownEdges.has(edgeKey(u,v)))continue;const p=g.nodes[u],q=g.nodes[v];c.strokeStyle='#efd08a20';c.lineWidth=16;c.beginPath();c.moveTo(...p);c.lineTo(...q);c.stroke();c.strokeStyle='#f9d58b';c.lineWidth=5;c.stroke();}
    if(a&&!view.reduced&&!a.back&&a.from!==a.to){const u=g.nodes[a.from],v=g.nodes[a.to],f=Math.min(1,a.age/.32),x=u[0]+(v[0]-u[0])*f,y=u[1]+(v[1]-u[1])*f;c.fillStyle='#fff6ce';c.beginPath();c.arc(x,y,7,0,TAU);c.fill();for(let i=1;i<=3;i++){const t=Math.max(0,f-i*.07);c.fillStyle='#ffe8aa'+['','aa','66','33'][i];c.beginPath();c.arc(u[0]+(v[0]-u[0])*t,u[1]+(v[1]-u[1])*t,5-i,0,TAU);c.fill();}}
    g.nodes.forEach(([x,y],i)=>{const active=i===last,on=lit.has(i),pulse=!view.reduced&&a?.to===i?Math.sin(Math.min(1,a.age/.35)*Math.PI)*5:0;c.fillStyle=active?'#ffdf8c25':on?'#f6dda41c':'#afc4df12';c.beginPath();c.arc(x,y,45+pulse,0,TAU);c.fill();c.strokeStyle=active?'#ffe69b':on?'#d1ba89':'#8193b4';c.lineWidth=active?3:2;c.beginPath();c.arc(x,y,34+pulse,0,TAU);c.stroke();star(c,x,y,active?24:20,on?'#ffe49e':'#b1c0db');c.fillStyle=active?'#ffe9a5':'#c4cee3';c.font='bold 15px sans-serif';c.textAlign='center';c.fillText(active?'当前':String(i+1),x,y+59);});
    const done=Math.max(0,path.length-1),total=g.edges.length;round(c,229,697,262,35,16,'#ffffff15');c.font='bold 18px sans-serif';c.fillStyle='#f8e6b1';c.textAlign='center';c.fillText(done+' / '+total+' 条星光路',360,721);
  }
  function visiblePath(s){return(gestures.get(s)?.path||s.path).slice();}
  function hud(s){const path=visiblePath(s),total=GRAPHS[s.level].edges.length;return{scoreLabel:'已连星路',score:Math.max(0,path.length-1),statLabel:'本关星路',stat:total,goal:'每条虚线走一次，点亮整个星座',progress:Math.max(0,path.length-1)/total,message:path.length?'当前星星有金色圆环；点上一颗星或「退一条线」可回退。':'先选一颗起点星星。逐颗点击或整条拖动，都可以连线。'};}
  function controls(s){return[{id:'back',label:'↶ 退一条线',disabled:!s.path.length},{id:'clear',label:'重新选起点',disabled:!s.path.length}];}
  function hint(s){const route=solve(s);if(!route)return{text:'这条路把剩余星路分开了。先退回一条线，再换个方向。',targets:s.path.length>1?[nodePoint(s,s.path[s.path.length-2])]:[],action:['back',{}]};if(!route.length)return{text:'星座已经全部点亮！'};return{text:s.path.length?'下一步连到 '+(route[0]+1)+' 号星星。':'从 '+(route[0]+1)+' 号星星出发，有一条走完所有线的路线。',targets:[nodePoint(s,route[0])],action:['visit',{node:route[0]}]};}
  function validate(s){const nat=(x,max)=>Number.isInteger(x)&&x>=0&&x<=max;if(!s||s.v!==1||s.id!==ID||!nat(s.level,9)||!nat(s.seed,4294967295)||s.rng!==s.seed||!['playing','won'].includes(s.phase)||!nat(s.moves,50)||!nat(s.stars,3)||!nat(s.score,5000)||!Number.isFinite(s.t)||s.t<0||s.t>1000000||!Array.isArray(s.path)||s.path.length!==s.moves||s.path.length>GRAPHS[s.level].edges.length+1)return false;const seen=new Set();for(let i=0;i<s.path.length;i++){if(!nat(s.path[i],GRAPHS[s.level].nodes.length-1))return false;if(i){const e=edgeKey(s.path[i-1],s.path[i]);if(!allEdges[s.level].has(e)||seen.has(e))return false;seen.add(e);}}const copy={...s};update(copy);return copy.phase===s.phase&&copy.score===s.score&&copy.stars===s.stars;}
  const G={id:ID,levels:10,meta:{title:'一笔星旅',category:'解谜',blurb:'点亮星星，沿着每条星光路走一次，画出自己的夜空。',tags:['一笔画','路线规划','星座'],color:'#a695d4',instructions:['点击一颗星星作为起点，再逐颗点击相邻星星，也可以按住连续拖动。','沿着虚线走，每条线只能使用一次。路线交叉处没有星星就不是节点，不能转弯。','点刚刚经过的上一颗星星，或点「退一条线」就能回退。拖动被取消时，本次整笔会恢复到按下前。','不计时、不扣分。提示会给出可走完剩余星路的下一颗星星。']},create,act,step,draw,hud,controls,hint,validate,needsFrame,solve,nodePoint,under,visiblePath,graphs:GRAPHS};
  if(typeof module!=='undefined'&&module.exports)module.exports=G;else(root.ExtraGames||(root.ExtraGames={}))[ID]=G;
})(typeof window!=='undefined'?window:globalThis);
