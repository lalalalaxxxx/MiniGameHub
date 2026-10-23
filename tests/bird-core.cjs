'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../assets/js/bird-core.js');
function fixture(mode='practice'){
 const s=C.fresh(mode,37);s.board.fill(null);s.charges=[];s.supplyLeft=100;
 const put=(i,color=0,special='',extra={})=>s.board[i]={uid:s.nextId++,kind:'bird',color,special,lock:0,hp:0,loot:'',...extra};
 return{s,put};
}
function invariant(s){
 assert.equal(s.board.length,s.rows*7);const ids=[...s.board,...s.next].filter(Boolean).map(b=>b.uid);assert.equal(ids.length,new Set(ids).size);
 assert.deepEqual(C.restore(s),s,'save roundtrip preserves pending timers and exact board identities');
}
test('Bird: five deterministic modes, dynamic boards, valid saves and pure hints',()=>{
 for(const mode of C.MODES)for(const seed of [0,1,19,37,741,2026]){
  const s=C.fresh(mode,seed);assert.deepEqual(s,C.fresh(mode,seed));invariant(s);const before=C.clone(s);assert(C.hint(s));assert.deepEqual(s,before);assert.equal(s.rows,mode==='ice'?9:10);
 }
});
test('Bird: exposed sides permit buried grabs, enclosed/locked/charging birds reject grabs',()=>{
 const {s,put}=fixture();put(63,1);const b=put(56);put(49,2);put(52,1);put(58,2);put(59,3);put(60,1);put(66,2);
 assert(C.selectable(s,56),'side-exposed bird below another bird is movable');assert(!C.selectable(s,59),'fully enclosed bird is blocked');
 assert(C.move(s,56,5).ok);assert.equal(s.board[68].uid,b.uid);assert.equal(s.board[56].color,2,'unsupported source column settles');invariant(s);
 s.board[68].lock=1;assert(!C.selectable(s,68));const before=C.clone(s);assert(!C.move(s,68,0).ok);assert.deepEqual(s,before);
 assert(!C.move(s,-1,5).ok);assert(!C.move(s,0,999).ok);
});
test('Bird: append during the charge window; other moves remain legal without a global lock',()=>{
 const {s,put}=fixture();put(63);put(64);put(66);put(67);put(69,2);
 assert(C.move(s,66,2).ok);assert.equal(s.charges[0].uids.length,3);assert.equal(s.score,0);const expires=s.charges[0].at;
 C.tick(s,.2);assert(C.move(s,67,3).ok);assert.equal(s.charges[0].uids.length,4);assert.equal(s.charges[0].at,expires,'appending does not restart a group forever');
 assert(!C.selectable(s,63));assert(C.move(s,69,5).ok,'unrelated move is accepted while match shakes');invariant(s);
 const r=C.tick(s,.54),pop=r.events.find(e=>e.type==='clear');assert(pop);assert.equal(pop.largest,4);assert.equal(pop.count,3);assert(s.board.some(b=>b?.special==='glow'));invariant(s);
});
test('Bird: orthogonal matches, four exact power tiers, protected new specials and blast chains',()=>{
 for(const n of [3,4,5,6,7]){const {s,put}=fixture();for(let c=0;c<n;c++)put(63+c);C.scan(s);assert.equal(s.score,0);const r=C.tick(s,.74);assert(r.events.some(e=>e.type==='clear'));assert.equal(s.board.filter(b=>b?.special===C.tier(n)&&b.special).length,n===3?0:1);invariant(s);}
 const diagonal=fixture();diagonal.put(56);diagonal.put(64);diagonal.put(58);assert.equal(C.groups(diagonal.s).length,0);
 const shaped=fixture();shaped.put(63);shaped.put(64);shaped.put(57);assert.equal(C.groups(shaped.s)[0].length,3);
 const {s,put}=fixture();put(63,0,'glow');put(64);put(65);put(56,1,'lightning');put(7,2,'fire');put(57,3,'whirlwind');C.scan(s);
 const r=C.tick(s,.74),triggers=r.events.find(e=>e.type==='clear').triggers;assert.equal(triggers.length,4);assert.equal(new Set(triggers.map(t=>t.index)).size,4);assert.equal(s.board.filter(Boolean).length,0);invariant(s);
 assert.deepEqual(C.area(s,31,'lightning'),Array.from({length:70},(_,i)=>i).filter(i=>Math.floor(i/7)===4||i%7===3));
 assert(!C.area(s,31,'fire').includes(24),'fire burns downward');assert(C.area(s,31,'fire').includes(65),'fire splashes across bottom neighbours');assert.equal(C.area(s,31,'glow').length,9);
});
test('Bird: preview drops from above, low-board supply rises, partial top occupancy survives',()=>{
 const {s,put}=fixture('classic');s.dropLeft=.1;const ids=s.next.map(b=>b.uid);put(63,0);C.tick(s,.11);for(const uid of ids)assert(s.board.some(b=>b?.uid===uid));assert(s.dropLeft>0);
 const partial=fixture('classic');for(let r=0;r<10;r++)partial.put(r*7,r%4);partial.s.dropLeft=.1;C.tick(partial.s,.11);assert.equal(partial.s.phase,'playing','one full column is not game over');
 const full=fixture('classic');for(let i=0;i<70;i++)full.put(i,(Math.floor(i/7)*2+i%7)%4);C.tick(full.s,.1);assert.equal(full.s.phase,'lost');
 const low=fixture();low.put(69,0);low.s.supplyLeft=0;C.tick(low.s,.1);assert(low.s.board.filter(Boolean).length>=21);invariant(low.s);
});
test('Bird: locks chip only when matched; Pandora boxes require special blasts and collect letters',()=>{
 const lock=fixture();lock.put(63,0,'',{lock:2});lock.put(64);lock.put(65);lock.put(56,1,'',{lock:1});C.scan(lock.s);C.tick(lock.s,.74);assert.equal(lock.s.board.find(b=>b?.color===0).lock,1);assert.equal(lock.s.board.find(b=>b?.color===1).lock,1,'adjacency alone does not open a lock');
 const {s,put}=fixture('pandora');put(63,0,'glow');put(64);put(65);put(56,-1,'',{kind:'box'});s.letters=['B','I','R','Z','Z','L'];s.timeLeft=20;C.scan(s);const r=C.tick(s,.74);assert.equal(s.chests,1);assert.deepEqual(s.letters,[]);assert(s.timeLeft>40);assert(r.events.some(e=>e.type==='reward'));invariant(s);
});
test('Bird: ice uses one-at-a-time top shots, neighbouring clears break ice and waves advance',()=>{
 const {s,put}=fixture('ice');put(42,0);put(49,0);put(56,1);put(43,-1,'',{kind:'ice',hp:1,loot:'clock'});put(57,-1,'',{kind:'ice',hp:1,loot:'egg'});
 s.next[0].color=0;assert(!C.selectable(s,42));assert(!C.move(s,42,0).ok);const uid=s.next[0].uid;assert(C.shoot(s,0).ok);assert(s.board.some(b=>b?.uid===uid));assert(!C.shoot(s,1).ok,'double contact cannot launch the same bird twice');
 const old=s.timeLeft;C.tick(s,.95);assert.equal(s.iceBroken,1);assert(s.timeLeft>old);assert(!s.board.some(b=>b?.loot==='clock'));s.supplyLeft=0;C.tick(s,.1);assert.equal(s.wave,2);assert(s.board.slice(0,49).some(b=>b?.kind==='ice'));invariant(s);
});
test('Bird: timed endings and corrupt save rejection',()=>{
 for(const mode of ['ice','pandora','fever']){const s=C.fresh(mode,37);s.timeLeft=.1;C.tick(s,.2);assert.equal(s.phase,mode==='ice'?'lost':'won');const before=C.clone(s);C.tick(s,1);assert.deepEqual(s,before);invariant(s);}
 for(const change of [s=>s.next[0].uid=s.board.find(Boolean).uid,s=>s.clock=NaN,s=>s.charges=[{uids:[999,998,997],at:0,anchor:999}],s=>s.rows=100,s=>s.board[0]={uid:1},s=>s.letters=['Q'],s=>s.mode='fake']){const s=C.fresh('ice',37);change(s);const restored=C.restore(s);assert.equal(restored.mode,'classic');assert.equal(restored.version,2);invariant(restored);}
});
test('Bird: sustained legal play retains unique pieces and reloadable asynchronous states',()=>{
 for(const mode of C.MODES)for(const seed of [0,37,741]){
  const s=C.fresh(mode,seed);for(let n=0;n<160&&s.phase==='playing';n++){const h=C.hint(s);if(h){const r=mode==='ice'?C.shoot(s,h[1]%7):C.move(s,...h);assert(r.ok||r.reason==='wait');}C.tick(s,.2);invariant(s);}
  if(mode==='ice')assert(s.wave>=3&&s.iceBroken>0,'generated ice waves advance through legal top shots without fixture assistance');
 }
});
