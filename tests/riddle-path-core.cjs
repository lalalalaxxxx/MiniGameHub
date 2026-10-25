'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {games,plan,solve}=require('./helpers/riddle-path.js');
const clone=s=>JSON.parse(JSON.stringify(s));
function tap(G,s,p){G.act(s,'pointerdown',p);return G.act(s,'pointerup',{...p,start:p});}
function settle(G,s){for(let i=0;i<100&&G.needsFrame(s)&&s.phase==='playing';i++)G.step(s,1/120);}

test('all twenty levels have legal solver wins and replayable touch/button UI plans',()=>{
  for(const id of Object.keys(games))for(let level=0;level<10;level++)for(const seed of[1,37]){
    const {s:won}=solve(id,level,seed);assert.equal(won.phase,'won',id+' '+level);assert.equal(won.stars,3);assert.equal(games[id].validate(won),true);
    const G=games[id],s=G.create(level,seed);for(const a of plan(id,level,seed)){assert.equal(a.type==='tap'?tap(G,s,a.point).ok:G.act(s,a.action).ok,true,id+' touch plan '+level);assert.equal(G.validate(clone(s)),true);settle(G,s);}assert.equal(s.phase,'won');const end=clone(s);G.step(s,.1);assert.deepEqual(s,end);
  }
});

test('boxtrail uses orthogonal one-cell movement, blocks walls and never pulls or pushes two boxes',()=>{
  const G=games.boxtrail,s=G.create(0),b=G.boards[0];assert.equal(G.act(s,'left').ok,true);const atWall=clone(s);assert.equal(G.act(s,'left').ok,false);assert.deepEqual(s,atWall);assert.equal(G.act(s,'right').ok,true);assert.equal(s.boxes[0],b.boxes[0],'walking away cannot pull a box');
  const p=G.center(s,s.p),before=s.p;G.act(s,'pointerdown',p);G.act(s,'pointermove',{x:p.x,y:p.y+200});assert.equal(s.p,before,'swipes commit on release');G.act(s,'pointerup',{x:p.x,y:p.y+200,start:p});assert.equal(s.p,before+b.w,'a long swipe still moves one cell');
  const target=G.center(s,s.p-1);assert.equal(tap(G,s,target).ok,true);const distant=G.center(s,s.p+3);assert.equal(tap(G,s,distant).ok,false,'tapping a remote cell cannot teleport');
  const paired=G.create(7),board=G.boards[7];paired.p=2+2*board.w;const initial=paired.boxes.slice();assert.equal(G.act(paired,'right').ok,false);assert.deepEqual(paired.boxes,initial);
});

test('boxtrail dead squares warn precisely and undo restores a solvable state',()=>{
  const G=games.boxtrail,s=G.create(0);G.act(s,'down');G.act(s,'right');const safe=clone(s),push=G.act(s,'up');assert.equal(push.ok,true);assert.equal(G.dead(s).length,1);assert.ok(push.events.some(e=>e.message?.includes('死角')));assert.equal(G.solve(s),null);assert.equal(G.hint(s).action[0],'back');assert.equal(G.act(s,'back').ok,true);assert.equal(s.p,safe.p);assert.deepEqual(s.boxes,safe.boxes);assert.deepEqual(s.route,safe.route);assert.ok(G.solve(s));
  for(let level=0;level<10;level++){const state=G.create(level),route=G.solve(state);for(const dir of route){G.act(state,dir);assert.equal(G.dead(state).length,0,'a solved route cannot enter a dead square');}}
});

test('boxtrail cancelled swipes and JSON resume cannot leave partial moves',()=>{
  const G=games.boxtrail,s=G.create(6);const p=G.center(s,s.p),before=clone(s);G.act(s,'pointerdown',p);G.act(s,'pointermove',{x:p.x+120,y:p.y});G.act(s,'pointercancel');assert.deepEqual(s,before);
  const route=G.solve(s);for(const dir of route.slice(0,4))G.act(s,dir);const saved=clone(s);assert.equal(G.validate(saved),true);for(const dir of G.solve(saved)){G.act(saved,dir);}assert.equal(saved.phase,'won');
});

test('starpath graphs are connected Euler puzzles with distinct non-overlapping touch targets',()=>{
  const G=games.starpath;let edges=0;for(const g of G.graphs){assert.ok(g.edges.length>=edges);edges=g.edges.length;const degree=g.nodes.map(()=>0),seen=new Set();for(const[a,b]of g.edges){assert.notEqual(a,b);const key=[a,b].sort((a,b)=>a-b).join(':');assert.ok(!seen.has(key));seen.add(key);degree[a]++;degree[b]++;}assert.ok([0,2].includes(degree.filter(d=>d%2).length));assert.ok(degree.every(d=>d>0));for(let i=0;i<g.nodes.length;i++)for(let j=i+1;j<g.nodes.length;j++)assert.ok(Math.hypot(g.nodes[i][0]-g.nodes[j][0],g.nodes[i][1]-g.nodes[j][1])>=110);}
});

test('starpath rejects non-adjacent and reused edges, and retracts exactly the preceding edge',()=>{
  const G=games.starpath,s=G.create(3);G.act(s,'visit',{node:0});const start=clone(s);assert.equal(G.act(s,'visit',{node:99}).ok,false);assert.deepEqual(s,start);G.act(s,'visit',{node:1});assert.equal(G.act(s,'visit',{node:3}).ok,false);assert.deepEqual(s.path,[0,1]);G.act(s,'visit',{node:2});G.act(s,'visit',{node:0});assert.deepEqual(s.path,[0,1,2,0]);assert.equal(G.act(s,'visit',{node:1}).ok,false,'first edge cannot be reused');G.act(s,'visit',{node:2});assert.deepEqual(s.path,[0,1,2],'the last edge is retracted');G.act(s,'back');assert.deepEqual(s.path,[0,1]);assert.equal(G.validate(s),true);
});

test('starpath fast swipes collect every intersected node in order and cancellation rolls back the whole gesture',()=>{
  const G=games.starpath,s=G.create(8),a=G.nodePoint(s,0),z=G.nodePoint(s,4),before=clone(s);G.act(s,'pointerdown',a);G.act(s,'pointermove',z);assert.deepEqual(G.visiblePath(s),[0,8,4],'a large pointer delta cannot skip the center star');assert.deepEqual(s,before,'preview is not persisted');const third=G.nodePoint(s,5);G.act(s,'pointermove',third);assert.deepEqual(G.visiblePath(s),[0,8,4,5]);G.act(s,'pointercancel');assert.deepEqual(s,before);assert.deepEqual(G.visiblePath(s),[]);
  G.act(s,'pointerdown',a);G.act(s,'pointermove',z);G.act(s,'pointerup',{...z,start:a});assert.deepEqual(s.path,[0,8,4]);assert.equal(G.validate(s),true);assert.equal(s.moves,3,'one drag changes moves for the shared undo history');
  const starting=clone(s);G.act(s,'pointerdown',G.nodePoint(s,5));G.act(s,'pointermove',G.nodePoint(s,6));G.act(s,'pointercancel');assert.deepEqual(s,starting);
});

test('starpath full continuous drawings win on release and can still be cancelled before release',()=>{
  const G=games.starpath;for(const level of[0,4,9]){const s=G.create(level),route=G.solve(s),first=G.nodePoint(s,route[0]);G.act(s,'pointerdown',first);for(const n of route.slice(1))G.act(s,'pointermove',G.nodePoint(s,n));assert.equal(s.phase,'playing');assert.equal(s.path.length,0);assert.equal(G.visiblePath(s).length,route.length);G.act(s,'pointercancel');assert.equal(s.path.length,0);G.act(s,'pointerdown',first);for(const n of route.slice(1))G.act(s,'pointermove',G.nodePoint(s,n));const last=G.nodePoint(s,route[route.length-1]);assert.equal(G.act(s,'pointerup',{...last,start:first}).ok,true);assert.equal(s.phase,'won');assert.equal(G.validate(s),true);}
});

test('hints supply a legal next step from every solver prefix and guide recovery from blocked paths',()=>{
  for(const id of Object.keys(games)){const G=games[id],s=G.create(8);let safety=0;while(s.phase==='playing'&&safety++<100){const h=G.hint(s);assert.ok(h.action);assert.ok(h.targets?.length);assert.equal(G.act(s,...h.action).ok,true);assert.equal(G.validate(s),true);}assert.equal(s.phase,'won');}
  const G=games.starpath,s=G.create(0);G.act(s,'visit',{node:1});assert.equal(G.solve(s),null);assert.equal(G.hint(s).action[0],'back');G.act(s,'back');assert.deepEqual(s.path,[]);assert.ok(G.solve(s));
});

test('both games sleep once feedback settles and validate progress by replay instead of trusting save fields',()=>{
  for(const[id,G]of Object.entries(games)){const s=G.create(3);assert.equal(G.needsFrame(s),false);const action=G.hint(s).action;G.act(s,...action);assert.equal(G.needsFrame(s),true);settle(G,s);assert.equal(G.needsFrame(s),false);const saved=clone(s);assert.equal(G.validate(saved),true);for(const[field,value]of[['level',10],['seed',-1],['rng',-1],['moves',s.moves+1],['phase','won'],['score',22],['stars',2],['t',NaN]]){const bad=clone(s);bad[field]=value;assert.equal(G.validate(bad),false,id+' '+field);}if(id==='boxtrail'){const bad=clone(s);bad.boxes[0]=bad.p;assert.equal(G.validate(bad),false);bad.boxes=s.boxes.slice();bad.route.push('diagonal');bad.moves++;assert.equal(G.validate(bad),false);}else{const bad=clone(s);bad.path=[0,1,0];bad.moves=3;assert.equal(G.validate(bad),false,'edge reuse in saves is rejected');}}
});

test('committed winning motion survives shell releaseHeld cancellation and expires through terminal drawing',()=>{
  const c=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>{target[key]=value;return true;}});
  for(const[id,G]of Object.entries(games))for(const reduced of[false,true]){
    const s=G.create(0);for(const a of plan(id,0)){if(a.type==='tap')tap(G,s,a.point);else G.act(s,a.action);}assert.equal(s.phase,'won');assert.equal(G.needsFrame(s),true);
    const committed=clone(s);G.act(s,'pointercancel',{});assert.deepEqual(s,committed);assert.equal(G.needsFrame(s),true,id+' winning animation survives shell cleanup');
    if(!reduced){G.draw(c,s,{time:0,dt:.01,reduced});assert.equal(G.needsFrame(s),true,'the last movement is not cut short');}
    for(let i=0;i<70&&G.needsFrame(s);i++)G.draw(c,s,{time:i/60,dt:1/60,reduced});assert.equal(G.needsFrame(s),false,id+' ending releases its animation');assert.deepEqual(s,committed,'drawing never changes saved terminal state');
  }
});
