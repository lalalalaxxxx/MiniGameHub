const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../assets/js/match-core.js');

function fixture(id='candyland',level=0){
  const s=C.fresh(id,level,9);
  s.board.forEach((t,i)=>{if(t.kind==='normal'||t.kind==='time'){t.color=(Math.floor(i/7)*2+i%7)%4;t.special='';}});
  // Deliberately unreachable test goal prevents fixtures ending mid-scenario.
  s.goals.colors=[{color:0,count:99999}];s.goals.score=0;
  return s;
}
function assertStable(s){
  assert.equal(s.board.length,49);assert(s.board.every(Boolean));
  assert.equal(new Set(s.board.map(t=>t.uid)).size,49);
  assert.equal(C.runs(s.board).length,0,'no unresolved matching line');
  assert.equal(s.board.filter(t=>t.kind==='chest'||t.kind==='ingredient').length+s.rescued,s.goals.rescue);
  assert.equal(s.clearedCovers+s.covers.filter(Boolean).length,s.goals.covers);
  assert.equal(s.clearedLocks+s.locks.filter(Boolean).length,s.goals.locks);
  if(s.phase==='playing')assert(C.hint(s),'live boards always have a legal move');
}

test('24 authored levels generate deterministic, playable, validated boards',()=>{
  assert.deepEqual(C.IDS,['candyland','gemquest']);
  assert.deepEqual(new Set(C.levels('candyland').map(c=>c.type)),new Set(['order','score','jelly','ingredient','timed']));
  for(const id of C.IDS){
    assert.equal(C.levels(id).length,12);
    for(let level=0;level<12;level++)for(let seed=0;seed<15;seed++){
      const a=C.fresh(id,level,seed),b=C.fresh(id,level,seed);
      assert.deepEqual(a,b);assertStable(a);assert.deepEqual(C.restore(id,a),a);
      assert.equal(a.phase,'playing');
    }
  }
  assert.throws(()=>C.fresh('unknown'));assert.throws(()=>C.fresh('candyland',12));
});

test('invalid swaps are free, atomic, and cannot move a locked tile or ingredient',()=>{
  const s=C.fresh('gemquest',2,7),before=C.clone(s);
  for(const pair of [[-1,0],[0,49],[0,48],[22,23],[3,4],[0,0]]){
    assert.equal(C.play(s,...pair).ok,false);assert.deepEqual(s,before);
  }
  let failed=false;
  for(let a=0;a<49&&!failed;a++)for(const b of C.neighbors(a)){
    const copy=C.clone(s),result=C.play(copy,a,b);
    if(!result.ok){assert.deepEqual(copy,s);failed=true;break;}
  }
  assert(failed);
});

test('four and five lines and intersecting shapes create distinct specials at the moved tile',()=>{
  for(const [length,special] of [[3,''],[4,'row'],[5,'rainbow']]){
    const s=fixture();
    for(let i=14;i<14+length;i++)s.board[i].color=0;
    s.board[16].color=1;s.board[23].color=0;s.board[14+length].color=2;
    const moving=s.board[23].uid,result=C.play(s,23,16),first=result.frames.find(f=>f.kind==='clear');
    assert(result.ok);assert.equal(result.frames[0].kind,'swap');assert.equal(first.board[16].uid,moving);
    assert.deepEqual(first.created,special?[{index:16,special}]:[]);
    assertStable(s);
  }
  const s=fixture();for(const i of [23,25,31,38,17])s.board[i].color=0;s.board[24].color=1;
  const result=C.play(s,17,24);
  assert.deepEqual(result.frames.find(f=>f.kind==='clear').created,[{index:24,special:'bomb'}]);
  assertStable(s);
});

test('all adjacent special combinations work, wrapped bombs fall and explode a second time',()=>{
  const specials=['row','col','bomb','rainbow'];
  for(const a of specials)for(const b of specials){
    const s=fixture();s.board[23].special=a;s.board[24].special=b;
    const ids=[s.board[23].uid,s.board[24].uid],result=C.play(s,23,24);
    assert(result.ok,`${a}+${b}`);assert(result.total>=7);
    const first=result.frames.find(f=>f.kind==='clear');
    assert(first.triggered.length>=2);
    if(a==='bomb'||b==='bomb'){
      const second=result.frames.find(f=>f.triggered.some(t=>t.special==='bomb-second'));
      assert(second,'wrapped candy must have a distinct second burst');
      const bombId=ids[a==='bomb'?0:1],firstFall=result.frames[result.frames.indexOf(first)+1];
      assert.equal(firstFall.kind,'fall');
      assert(firstFall.board.some(t=>t.uid===bombId),'first pulse preserves the moving wrapped candy');
      assert(!s.board.some(t=>t.uid===bombId),'second pulse consumes it');
    }
    assertStable(s);
    const frozen=C.clone(result.frames);s.board[0].color=(s.board[0].color+1)%4;
    assert.deepEqual(result.frames,frozen,'animation frames are immutable snapshots');
  }
});

test('rainbow plus normal clears that color; striped plus wrapped spans three rows and columns',()=>{
  const s=fixture();s.board[23].special='rainbow';s.board[24].color=2;
  const result=C.play(s,23,24),first=result.frames.find(f=>f.kind==='clear');
  const targets=first.board.flatMap((t,i)=>t.color===2?[i]:[]);
  assert(targets.every(i=>first.removed.includes(i)));
  const t=fixture();t.board[23].special='bomb';t.board[24].special='col';
  const combo=C.play(t,23,24).frames.find(f=>f.kind==='clear');
  const affected=new Set([...combo.removed,...combo.held]);
  for(let i=0;i<49;i++)if(Math.abs(Math.floor(i/7)-3)<=1||Math.abs(i%7-3)<=1)assert(affected.has(i));
});

test('frosting takes one hit per pulse, chains release, and rescue pieces only exit at the bottom',()=>{
  const s=fixture('candyland',6);s.board[16].special='row';s.board[17].special='col';
  const r=C.play(s,16,17),firstFall=r.frames.find(f=>f.kind==='fall');
  assert.equal(firstFall.covers[17],1,'one burst removes just one layer');assertStable(s);
  const locked=fixture('gemquest',2);
  locked.board[22].color=0;locked.board[24].color=0;locked.board[23].color=1;locked.board[16].color=0;
  const result=C.play(locked,16,23),first=result.frames.find(f=>f.kind==='clear');
  assert(result.ok);assert(first.unlocked.includes(22));assert(first.unlocked.includes(24));assertStable(locked);
  for(const [id,level] of [['gemquest',0],['candyland',4]]){
    const t=fixture(id,level),rescueIds=t.board.filter(p=>p.kind==='chest'||p.kind==='ingredient').map(p=>p.uid);
    t.board[23].special='rainbow';t.board[24].special='rainbow';
    const result=C.play(t,23,24),clear=result.frames.find(f=>f.kind==='clear'),rescue=result.frames.filter(f=>f.kind==='rescue');
    assert(clear.removed.every(i=>!rescueIds.includes(clear.board[i].uid)));
    assert.equal(t.rescued,rescueIds.length);assert(rescue.length);
    assert(rescue.every(f=>f.rescued.every(i=>i>=42)));assertStable(t);
  }
});

test('shuffle retains obstacles, objectives, rescue positions and identities without spending a move',()=>{
  for(const id of C.IDS){
    const s=C.fresh(id,11,69),before=C.clone(s),pinned=before.board.flatMap((t,i)=>before.locks[i]||t.kind==='chest'||t.kind==='ingredient'?[[i,t.uid]]:[]);
    assert(C.shuffle(s).ok);assert.equal(s.movesUsed,before.movesUsed);assert.equal(s.movesLeft,before.movesLeft);
    assert.equal(s.score,before.score);assert.deepEqual(s.collected,before.collected);
    assert.deepEqual(s.goals,before.goals);assert.deepEqual(s.covers,before.covers);assert.deepEqual(s.locks,before.locks);
    assert.deepEqual(new Set(s.board.map(t=>t.uid)),new Set(before.board.map(t=>t.uid)));
    for(const [i,uid] of pinned)assert.equal(s.board[i].uid,uid);
    assertStable(s);assert.deepEqual(C.restore(id,s),s);
  }
});

test('timed levels use real supplied elapsed time, +5 second pickups, and explicit terminal states',()=>{
  const s=C.fresh('candyland',7,1);assert.equal(s.movesLeft,null);assert.equal(s.timeLeft,90);
  C.tick(s,.25);assert.equal(s.timeLeft,89.75);
  const paused=C.clone(s);assert.equal(C.tick(s,0).ok,false);assert.deepEqual(s,paused);
  assert.equal(C.tick(s,NaN).ok,false);assert.deepEqual(s,paused);
  const pickup=fixture('candyland',7);pickup.timeLeft=20;pickup.board[0].kind='time';pickup.board[23].special='rainbow';pickup.board[24].special='rainbow';
  const r=C.play(pickup,23,24);assert(r.ok);assert(pickup.timeBonus>=5);assert(pickup.timeLeft>=25);assert.equal(pickup.movesLeft,null);
  assert(r.frames.some(f=>f.timeBonuses&&f.timeBonuses.length));
  C.tick(s,100);assert.equal(s.timeLeft,0);assert.equal(s.phase,'lost');const end=C.clone(s);assert.equal(C.play(s,0,1).ok,false);C.tick(s,1);assert.deepEqual(s,end);
  assert.deepEqual(C.restore('candyland',s),s);
  const normal=C.fresh('candyland',0,1),before=C.clone(normal);C.tick(normal,999);assert.deepEqual(normal,before);
});

test('all authored levels can be won through legal play; final allowed move is a win',()=>{
  for(const id of C.IDS)for(let level=0;level<12;level++){
    let won=false;
    // The helper follows only public, deterministic hints; no goals, counters,
    // random values or boards are replaced to obtain these completions.
    for(const seed of [17,1,3,8,12,27]){
      const s=C.fresh(id,level,seed);
      for(let moves=0;moves<100&&s.phase==='playing';moves++){
        const result=C.play(s,...C.hint(s));assert(result.ok);assert(result.frames.length<800);
        assertStable(s);assert.deepEqual(C.restore(id,s),s);
        if(s.timeLeft!==null)C.tick(s,2);
      }
      if(s.phase==='won'){won=true;const before=C.clone(s);assert.equal(C.play(s,0,1).ok,false);assert.equal(C.shuffle(s).ok,false);assert.deepEqual(s,before);break;}
    }
    assert(won,`${id} level ${level+1} should have a legal winning route`);
  }
  const s=C.fresh('candyland',0,123);s.movesLeft=1;s.goals.colors=[];s.goals.score=1;
  assert(C.play(s,...C.hint(s)).ok);assert.equal(s.movesLeft,0);assert.equal(s.phase,'won');
});

test('save validation rejects corrupt fields and progress while valid saves remain exact',()=>{
  const good=C.fresh('gemquest',3,123);C.play(good,...C.hint(good));
  for(const mutate of [s=>s.board.pop(),s=>s.board[0].uid=s.board[1].uid,s=>s.board[0].special='bad',s=>s.board[0].color=99,s=>s.movesLeft=-1,s=>s.movesUsed++,s=>s.covers[0]=2,s=>s.locks[0]=1,s=>s.rescued=999,s=>s.goals.colors[0].count=1,s=>s.phase='won',s=>s.rng=NaN,s=>s.collected[0]=-1,s=>s.nextId=1,s=>s.timeLeft=90]){
    const broken=C.clone(good);mutate(broken);const restored=C.restore('gemquest',broken);
    assert.equal(restored.level,good.level);assert.equal(restored.movesUsed,0);assertStable(restored);
  }
  const restored=C.restore('gemquest',good);assert.deepEqual(restored,good);restored.board[0].color=99;assert.notEqual(good.board[0].color,99);
});
