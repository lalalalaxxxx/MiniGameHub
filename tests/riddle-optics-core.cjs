'use strict';
const assert = require('node:assert/strict');
const { games, plan } = require('./helpers/riddle-optics.js');
const clone = value => JSON.parse(JSON.stringify(value));
const pop = n => { let sum = 0; for (; n; n &= n - 1) sum++; return sum; };
function settle(game, s) { for (let i = 0; i < 100 && game.needsFrame(s); i++) game.step(s, 1 / 120); assert.equal(game.needsFrame(s), false, 'animation must go idle'); }
let solved = 0;
for (const game of Object.values(games)) {
  for (let level = 0; level < 10; level++) for (const seed of [1, 37, 2026]) {
    const s = game.create(level, seed); assert.deepEqual(s, game.create(level, seed)); assert(game.validate(s)); assert.equal(s.phase, 'playing'); assert.equal(game.needsFrame(s), false);
    const before = JSON.stringify(s), hint = game.hint(s), route = game.solve(s); assert.equal(JSON.stringify(s), before, 'hint and solver must be pure'); assert(route.length > 0); assert.equal(route.length, s.par); assert.deepEqual(hint.move, route[0]); assert.deepEqual(hint.targets[0], game.center(s, route[0].index));
    for (const move of route) {
      const p = game.center(s, move.index); const result = game.act(s, 'pointerup', { ...p, start: p }); assert(result.ok); assert(result.events.every(e => ['rotate','collect','drop','move','clear','hit','finish'].includes(e.type))); assert(game.validate(s)); assert(game.validate(clone(s))); settle(game,s);
    }
    assert.equal(s.phase,'won'); assert.equal(s.stars,3); assert(s.score>0); assert(game.validate(s)); const final = clone(s); assert.equal(game.act(s,route[0].type,route[0]).ok,false); assert.deepEqual(s,final); solved++;
    const actions = plan(game.id,level,seed); assert.equal(actions.length,route.length); assert(actions.every(a=>a.type==='tap'&&Number.isFinite(a.point.x)&&Number.isFinite(a.point.y)));
  }
  const s = game.create(9, 37), action = game.id === 'mirrorlight' ? 'rotate' : 'flip';
  for (const index of [-1,100,NaN,Infinity,1.5,'1']) { const before=clone(s); assert.equal(game.act(s,action,{index}).ok,false); assert.deepEqual(s,before); }
  for (const p of [{x:-5,y:200},{x:800,y:400},{x:NaN,y:200},{x:100,y:Infinity},{x:100,y:200,start:{x:100,y:300}},{x:100,y:200,start:{x:NaN,y:200}}]) { const before=clone(s); assert.equal(game.act(s,'pointerup',p).ok,false); assert.deepEqual(s,before); }
  const moves=s.moves; for (const direction of ['left','right']) assert(game.act(s,direction).ok); assert.equal(s.moves,moves); assert(game.validate(s));
  game.act(s,action); assert(game.needsFrame(s)); settle(game,s); assert(game.validate(s));
  // A child can tap again during the feedback animation without losing input.
  for(let i=0;i<8;i++) { assert(game.act(s,action,{index:0}).ok); assert(game.validate(s)); } assert(s.anims.length <= (game.id==='mirrorlight'?7:16)); settle(game,s);
  for (const mutation of [x=>x.level=10,x=>x.seed=-1,x=>x.rng=42,x=>x.moves=-1,x=>x.t=NaN,x=>x.selected=100,x=>x.par=999,x=>x.phase='won',x=>x.score=999,x=>x.stars=3,x=>x.anims=[{index:999,t:0}],x=>x.anims=[{index:0,t:NaN}],x=>x.anims=Array(101).fill({index:0,t:0})]) { const corrupt=clone(game.create(9)); mutation(corrupt); assert.equal(game.validate(corrupt),false,`${game.id}: invalid restore accepted`); }
  // Exercise real Canvas draw calls with a no-op target, including final animation.
  const drawing = new Proxy({}, { get: (target,key) => key in target ? target[key] : key==='createLinearGradient' ? () => ({addColorStop(){}}) : () => {}, set:(target,key,value)=>(target[key]=value,true) });
  const ending=game.create(0); const m=game.solve(ending)[0]; game.act(ending,m.type,m); const beforeDraw=JSON.stringify(ending); for(const time of [0,.1,.4,.9,1.2]) game.draw(drawing,ending,{time,dt:.1,reduced:false}); game.draw(drawing,clone(ending),{time:0,dt:0,reduced:true}); assert.equal(JSON.stringify(ending),beforeDraw,'rendering must not mutate saved state');
}
const mirror = games.mirrorlight;
// All eight reflection directions, without relying on the authored solutions.
const origins=[[1,2,0],[2,1,1],[3,2,2],[2,3,3]], ref=[[3,2,1,0],[1,0,3,2]], dx=[1,0,-1,0],dy=[0,1,0,-1];
for(let orientation=0;orientation<2;orientation++)for(let d=0;d<4;d++){const out=ref[orientation][d],target=(2+dy[out])*5+2+dx[out],layout={source:origins[d],mirrors:[12],prisms:[],walls:[],targets:[target]};assert(mirror.trace(layout,orientation).won);}
const split={source:[0,2,0],mirrors:[],prisms:[[12,0]],walls:[],targets:[2,14]};assert.deepEqual(mirror.trace(split,0).lit.sort((a,b)=>a-b),[2,14]);assert.equal(mirror.trace({...split,walls:[13]},0).won,false);
const loop={source:[2,1,0],mirrors:[8,18,16,6],prisms:[],walls:[],targets:[24]};const loopResult=mirror.trace(loop,5);assert(loopResult.loops>0);assert(loopResult.segments.length<=100);assert.equal(loopResult.won,false);
for(let level=0;level<10;level++){const s=mirror.create(level),layout=mirror.layouts[level];let best=Infinity;for(let mask=0;mask<1<<layout.mirrors.length;mask++)if(mirror.trace(layout,mask).won)best=Math.min(best,pop(mask^s.bits));assert.equal(mirror.solve(s).length,best);}
const fly=games.firefly;
assert.equal(fly.influence(3,0),(1<<0)|(1<<1)|(1<<3));assert.equal(fly.influence(3,1),(1<<0)|(1<<1)|(1<<2)|(1<<4));assert.equal(fly.influence(3,4),(1<<1)|(1<<3)|(1<<4)|(1<<5)|(1<<7));assert.equal(fly.influence(4,3),(1<<2)|(1<<3)|(1<<7));
for(const level of [4,9]) {const s=fly.create(level),mask=s.mask;fly.act(s,'flip',{index:0});fly.act(s,'flip',{index:0});assert.equal(s.mask,mask);settle(fly,s);assert(fly.validate(s));for(const index of [2,4,1])fly.act(s,'flip',{index});for(const move of fly.solve(s))fly.act(s,move.type,move);assert.equal(s.phase,'won');assert(fly.validate(s));}
assert.deepEqual(Array.from({length:10},(_,i)=>fly.create(i).par),[1,2,3,4,5,3,4,5,6,7]);
console.log(`Riddle optics: ${solved} complete UI-action solutions; minimal solvers, reflection/split/loop geometry, toggle boundaries, hints, restore and animation checks passed.`);
