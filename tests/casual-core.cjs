'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {C,advance,settle,bubble,brick,miner,rope,snail}=require('./helpers/casual');
test('Casual: all 50 authored levels have legal complete solutions; rope and snail allow three stars',()=>{
 for(const [id,solve] of Object.entries({bubblepop:bubble,brickball:brick,goldminer:miner,ropefeast:rope,snailquest:snail})){
  for(let level=0;level<10;level++){const s=C.fresh(id,level,37);solve(s);assert.equal(s.phase,'won',id+' '+level);if(['ropefeast','snailquest'].includes(id))assert.equal(s.stars,3,id+' '+level);assert.deepEqual(C.restore(id,s),s,id+' terminal save');const frozen=C.clone(s);advance(s,2);assert.deepEqual(s,frozen);}
  console.log('PASS ten levels '+id);
 }
});
test('Casual: seeded bubble supply and mine scatter remain achievable',()=>{
 for(const seed of [0,901,4294967295])for(const level of [0,5,9])for(const [id,solve] of [['bubblepop',bubble],['goldminer',miner]]){const s=C.fresh(id,level,seed);solve(s);assert.equal(s.phase,'won',`${id}/${level}/${seed}`);}
});
test('Casual: midflight saves resume deterministically, and frame chunking preserves physics',()=>{
 for(const id of Object.keys(C.META)){
  const s=C.fresh(id,4,33);C.act(s,id==='ropefeast'?'cut':id==='snailquest'?'switch':'fire',{index:0,x:310,y:200});advance(s,.4);const copy=C.restore(id,s);assert.deepEqual(copy,s);advance(s,1);advance(copy,1);assert.deepEqual(copy,s);
  const a=C.fresh(id,2,3),b=C.clone(a);C.act(a,'fire',{x:410,y:100});C.act(b,'fire',{x:410,y:100});for(let i=0;i<60;i++)C.tick(a,1/60);for(let i=0;i<120;i++)C.tick(b,1/120);assert.deepEqual(a,b);
 }
});
test('Casual: bubble ceiling support, rainbow, wall banks, swap and exhausted shots',()=>{
 const s=C.fresh('bubblepop',0,1);s.bubbles=[{uid:1,row:0,col:5,...C.bpos(0,5),color:0,pet:true},{uid:2,row:1,col:4,...C.bpos(1,4),color:0,pet:false},{uid:3,row:1,col:5,...C.bpos(1,5),color:1,pet:false}];s.nextId=4;s.color=2;s.nextColor=1;C.act(s,'swap');assert.equal(s.color,1);C.act(s,'power');assert.equal(s.rainbows,1);assert.equal(s.color,-1);C.act(s,'fire',{x:360,y:50});let events=[];for(let i=0;i<1000&&s.shot;i++)events.push(...C.tick(s,1/120).events);assert.equal(s.phase,'won');assert(events.some(e=>e.type==='cascade'));assert.equal(s.rescued,1);
 const bank=C.fresh('bubblepop');C.act(bank,'fire',{x:0,y:610});events=[];for(let i=0;i<300&&bank.shot;i++)events.push(...C.tick(bank,1/120).events);assert(events.some(e=>e.type==='bounce'));
 const lose=C.fresh('bubblepop');lose.shots=1;lose.color=3;C.act(lose,'fire',{x:360,y:100});settle(lose);assert.equal(lose.phase,'lost');
 const swapped=C.fresh('bubblepop',5,37);C.act(swapped,'power');C.act(swapped,'swap');assert.equal(swapped.nextColor,-1);assert.deepEqual(C.restore('bubblepop',swapped),swapped);C.act(swapped,'fire',{x:360,y:100});settle(swapped);assert.equal(swapped.color,-1,'reserved rainbow survives swapping and a normal shot');
});
test('Casual: numbered brick damage, pickup, recall and bottom-line failure',()=>{
 const s=C.fresh('brickball');s.bricks=[{uid:1,x:322,y:100,w:76,h:60,hp:1,max:1}];s.pickups=[{uid:2,x:360,y:400}];s.nextId=3;s.rowsLeft=0;C.act(s,'fire',{x:360,y:0});settle(s);assert.equal(s.phase,'won');assert.equal(s.destroyed,1);assert.equal(s.ballCount,7);
 const fail=C.fresh('brickball');fail.bricks[0].y=590;C.act(fail,'fire');assert(C.act(fail,'recall').ok);assert.equal(fail.phase,'lost');assert.equal(fail.balls.length,0);
});
test('Casual: rope gestures cut once, bubble/wind are reversible, and snail waits safely',()=>{
 const s=C.fresh('ropefeast',9);C.act(s,'cut',{path:[{x:50,y:240},{x:350,y:240},{x:680,y:240}]});assert.equal(s.moves,1);assert.equal(s.cuts,3);assert(!C.act(s,'cut',{index:0}).ok);
 const lifted=C.fresh('ropefeast',7);C.act(lifted,'cut',{index:0});advance(lifted,.5);assert(lifted.candy.y<440);C.act(lifted,'pop');C.act(lifted,'fan');advance(lifted,.4);assert(lifted.candy.x>250);C.act(lifted,'fan');assert(!lifted.fanOn);
 const wait=C.fresh('snailquest');advance(wait,12);const x=wait.snail.x;assert(wait.snail.waiting);advance(wait,2);assert.equal(wait.snail.x,x);C.act(wait,'switch',{index:0});advance(wait,10);assert.equal(wait.phase,'won');
});
test('Casual: upstairs stars cannot be collected from below the elevator',()=>{
 const s=C.fresh('snailquest',8,37),l=C.layout(s);
 for(let i=0;i<1200&&!s.riding;i++)C.tick(s,1/120);
 assert(s.riding,'the snail boards the elevator through normal walking');assert.equal(s.snail.y,l.lift.bottom);assert(s.snail.x>s.tokens[0].x,'the upstairs star is horizontally behind the snail');assert.equal(s.stars,0);assert(!s.tokens[0].got);
 advance(s,2);assert.equal(s.stars,0);assert(s.snail.waiting);assert.deepEqual(C.restore('snailquest',s),s);
 C.act(s,'switch',{index:l.lift.key});for(let i=0;i<600&&!s.tokens[0].got;i++)C.tick(s,1/120);
 assert(s.tokens[0].got);assert.equal(s.stars,1);assert(Math.abs(s.snail.y-l.lift.top)<2);assert.equal(s.score,100);
 snail(s);assert.equal(s.phase,'won');assert.equal(s.stars,3);
});

test('Casual: malformed saves and actions cannot inject missing or duplicate pieces',()=>{
 for(const id of Object.keys(C.META)){
  for(const corrupt of [s=>{s.score=-1;},s=>{delete s.moves;},s=>{s.level=99;},s=>{s.rng='bad';},s=>{s.phase='stuck';},s=>{if(s.aim)s.aim.x=null;else if(s.tokens)s.tokens[0].uid=300;else s.hook.mode='bad';}]){const s=C.fresh(id,4,37);corrupt(s);assert.equal(C.restore(id,s).level,0,id);}
  const s=C.fresh(id,4,37),old=C.clone(s);assert(!C.act(s,'aim',{x:NaN,y:100}).ok);assert(!C.act(s,'fire',{x:Infinity}).ok);assert.deepEqual(s,old);
 }
 for(const id of ['bubblepop','brickball','goldminer']){const s=C.fresh(id,4,37),list=s.bubbles||s.bricks||s.items;list[1].uid=list[0].uid;assert.equal(C.restore(id,s).level,0);}
});
