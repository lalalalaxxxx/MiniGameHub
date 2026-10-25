'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../assets/js/extras/colorsort.js');
const {plan,settle}=require('./helpers/riddle-sort.js');
const clone=s=>JSON.parse(JSON.stringify(s));
const signature=bottles=>bottles.map(b=>b.join('')).sort().join('|');
// Independent reference rule/solver: no production move or solver helpers.
function successors(bottles){
  const results=[];
  for(let from=0;from<bottles.length;from++){
    const source=bottles[from];if(!source.length)continue;
    let count=1;while(count<source.length&&source[source.length-1-count]===source.at(-1))count++;
    for(let to=0;to<bottles.length;to++){
      const target=bottles[to];if(from===to||target.length+count>4||target.length&&target.at(-1)!==source.at(-1))continue;
      const next=bottles.map(b=>b.slice());next[to]=target.concat(source.slice(-count));next[from]=source.slice(0,-count);
      results.push({from,to,count,bottles:next});
    }
  }
  return results;
}
function distance(bottles){
  const queue=[{bottles,d:0}],seen=new Set([signature(bottles)]);
  for(let head=0;head<queue.length;head++){
    const node=queue[head];if(node.bottles.every(b=>!b.length||b.length===4&&b.every(c=>c===b[0])))return node.d;
    for(const next of successors(node.bottles)){const key=signature(next.bottles);if(!seen.has(key)){seen.add(key);queue.push({bottles:next.bottles,d:node.d+1});}}
  }
  return null;
}
test('colorsort: ten fixed boards have independently proven shortest solutions and three-star legal play',()=>{
  for(let level=0;level<10;level++){
    const s=G.create(level,37),route=G.solve(s);assert(G.validate(s));assert(!G.needsFrame(s));
    assert.deepEqual(G.create(level,87).bottles,s.bottles,'seed cannot produce an unsolvable random layout');
    assert.equal(s.bottles.filter(b=>!b.length).length,2);assert.equal(distance(s.bottles),s.par);assert.equal(route.length,s.par);
    for(const move of route){
      const next=successors(s.bottles).find(m=>m.from===move.from&&m.to===move.to);assert(next,'solver move follows independent rules');
      const before=s.moves,result=G.act(s,'pour',move);assert(result.ok);assert.equal(s.moves,before+1);assert.deepEqual(s.bottles,next.bottles);
      assert.equal(s.phase,'playing','last pour must finish visually before the result');assert(G.validate(s));assert(G.needsFrame(s));settle(s);assert(G.validate(s));
    }
    assert.equal(s.phase,'won');assert.equal(s.stars,3);assert.equal(s.moves,s.par);assert(!G.needsFrame(s));
    const end=clone(s);for(let i=0;i<100;i++)G.step(s,1/60);assert.deepEqual(s,end);assert.equal(G.act(s,'pour',route[0]).ok,false);
  }
});
test('colorsort: whole contiguous runs move together, mismatch/full/insufficient space never spills',()=>{
  const s=G.create(0);s.bottles=[[0,0,1,1],[0,1,1],[0],[]];assert(G.validate(s));
  const before=clone(s.bottles);
  for(const move of [{from:0,to:1},{from:0,to:2},{from:3,to:0},{from:0,to:0},{from:99,to:0},{from:0,to:2.5}]){
    assert.equal(G.act(s,'pour',move).ok,false);assert.deepEqual(s.bottles,before);assert.equal(s.moves,0);
  }
  assert(G.act(s,'pour',{from:0,to:3}).ok);assert.deepEqual(s.bottles,[[0,0],[0,1,1],[0],[1,1]]);assert.equal(s.anim.count,2);settle(s);
  const full=G.create(0);assert.equal(G.act(full,'pour',{from:0,to:1}).ok,false);assert.match(full.note,/满/);
});
test('colorsort: two taps and drags agree, selecting and cancelling never commit liquid',()=>{
  const initial=G.create(3),move=G.solve(initial)[0],a=G.center(initial,move.from),b=G.center(initial,move.to);
  const cancelled=clone(initial);G.act(cancelled,'pointerdown',{...a,start:a});G.act(cancelled,'pointermove',{...b,start:a});G.act(cancelled,'pointercancel');assert.deepEqual(cancelled,initial);
  G.act(cancelled,'pointerup',{x:1,y:1,start:a});assert.deepEqual(cancelled,initial,'dropping outside does not pour');
  const tapped=clone(initial);assert(G.act(tapped,'pointerup',{...a,start:a}).ok);assert.equal(tapped.moves,0);settle(tapped);assert.equal(tapped.selected,move.from);assert(!G.needsFrame(tapped));
  const selected=clone(tapped);G.act(tapped,'pointercancel');assert.deepEqual(tapped,selected);
  assert(G.act(tapped,'pointerup',{...b,start:b}).ok);
  const dragged=clone(initial);assert(G.act(dragged,'pointerup',{...b,start:a}).ok);assert.deepEqual(dragged.bottles,tapped.bottles);assert.equal(dragged.moves,1);
  const frozen=clone(dragged);assert.equal(G.act(dragged,'pour',move).ok,false);assert.deepEqual(dragged,frozen,'additional contacts cannot double-submit during flow');
});
test('colorsort: intermediate liquid, lift and celebration saves resume deterministically and idle state sleeps',()=>{
  for(const level of [0,5,9]){
    const s=G.create(level),move=G.solve(s)[0];G.act(s,'bottle',{index:move.from});G.step(s,.06);assert(G.validate(s));
    const lifted=clone(s);G.step(s,.1);G.step(lifted,.1);assert.deepEqual(s,lifted);assert(!G.needsFrame(s));
    G.act(s,'bottle',{index:move.to});for(let i=0;i<35;i++)G.step(s,1/120);
    const restored=clone(s);assert(G.validate(restored));
    for(let i=0;i<180;i++){assert.deepEqual(G.step(s,1/120),G.step(restored,1/120));assert.deepEqual(s,restored);}
    assert(!G.needsFrame(s));const idle=clone(s);for(let i=0;i<1000;i++)G.step(s,.05);assert.deepEqual(s,idle);
  }
  const s=G.create(0);s.bottles=[[0,0],[1,1],[0,0],[1,1]];assert(G.validate(s));G.act(s,'pour',{from:0,to:2});
  for(let i=0;i<113;i++)G.step(s,1/120);assert(s.spark);assert(G.validate(s));
  G.act(s,'pour',{from:2,to:0});assert.equal(s.spark,null,'moving a celebrated bottle clears its old sparkle');assert(G.validate(s));
});
test('colorsort: hints are legal from intermediate decisions and real UI plans finish every board',()=>{
  for(let level=0;level<10;level++){
    const s=G.create(level),actions=plan('colorsort',level,37);assert.equal(actions.length,s.par*2);
    const hint=G.hint(s);assert.equal(hint.targets.length,2);const [from,to]=hint.targets.map(p=>G.under(s,p));assert(G.amount(s.bottles,from,to)>0);
    for(const action of actions){assert.equal(action.type,'tap');assert(G.act(s,'pointerup',{...action.point,start:action.point}).ok);settle(s);}
    assert.equal(s.phase,'won');assert(G.validate(s));assert.equal(G.hint(s).targets,undefined);
  }
});
test('colorsort: saved-state validation rejects corruption, invented pours and premature wins',()=>{
  const base=G.create(9),mutations=[s=>s.bottles[0].push(0),s=>s.bottles[0][0]=5,s=>s.bottles[0][0]=NaN,s=>s.bottles.pop(),s=>s.par=1,s=>s.phase='lost',s=>s.selected=99,s=>s.focus=-1,s=>s.t=Infinity,s=>s.selectionAge=-1,s=>s.phase='won',s=>s.stars=3,s=>s.spark={id:0,t:0},s=>s.anim={from:0,to:1,count:4,color:0,t:0,source:[],target:[]}];
  for(const mutate of mutations){const s=clone(base);mutate(s);assert.equal(G.validate(s),false);}
  for(const bad of [null,{},[],{...base,level:100}])assert.equal(G.validate(bad),false);
  const flowing=clone(base);G.act(flowing,'pour',G.solve(flowing)[0]);assert(G.validate(flowing));
  for(const mutate of [s=>s.anim.count++,s=>s.anim.target.push(0),s=>s.anim.t=-1,s=>s.anim.source[0]=9,s=>s.anim.color=(s.anim.color+1)%5]){const s=clone(flowing);mutate(s);assert.equal(G.validate(s),false);}
});
test('colorsort: iPad bottle hit areas stay separate, color identifiers and control navigation are stable',()=>{
  for(let level=0;level<10;level++){
    const s=G.create(level);assert(G.controls(s).length<=4);assert.equal(new Set(G.controls(s).map(c=>c.id)).size,4);
    for(let i=0;i<s.bottles.length;i++){const p=G.center(s,i);assert.equal(G.under(s,p),i);assert.equal(G.under(s,{x:p.x+54,y:p.y}),i);}
    G.act(s,'right');assert.equal(s.focus,1);G.act(s,'left');assert.equal(s.focus,0);G.act(s,'confirm');assert.equal(s.selected,0);settle(s);G.act(s,'deselect');assert.equal(s.selected,-1);assert(!G.needsFrame(s));
  }
});
