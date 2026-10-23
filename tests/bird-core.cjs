'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../assets/js/bird-core.js');
const clone=C.clone;

function invariant(s){
  assert.equal(s.board.length,49);assert.equal(s.covers.length,49);assert.equal(s.movesLeft,null);
  const ids=s.board.filter(Boolean).map(t=>t.uid);assert.equal(new Set(ids).size,ids.length);
  for(let col=0;col<7;col++){
    let occupied=false;
    for(let row=0;row<7;row++){const p=s.board[row*7+col];if(p)occupied=true;else assert(!occupied,'columns settle without interior gaps');}
  }
  assert.deepEqual(C.restore('birdblast',s),s,'every settled and timed state survives reload');
}

function fixture(size=3,mode='practice'){
  const s=C.fresh('birdblast',11,741,mode);s.board.fill(null);s.covers.fill(0);s.nextId=1;
  if(mode==='ice')s.clearedCovers=s.goals.covers;
  const put=(i,color=0,special='',kind='normal')=>s.board[i]={uid:s.nextId++,kind,color,special};
  // Moving the top of column 6 onto column 3 joins disconnected red branches.
  // Every initial group is below three, including the L-shaped three-bird case.
  put(45);put(38);
  const left=Math.min(2,Math.max(0,size-3)),right=Math.max(0,size-5);
  for(let x=0;x<left;x++){const col=2-x;put(28+col);put(35+col,1);put(42+col,2);}
  for(let x=0;x<right;x++){const col=4+x;put(28+col);put(35+col,1);put(42+col,2);}
  put(20);put(27,3);put(34,4);put(41,3);put(48,4);
  return {s,put,move:[20,3]};
}

test('Bird modes: deterministic stages, valid saves, compact columns and no opening auto-clears',()=>{
  for(const mode of C.MODES)for(let level=0;level<12;level++)for(const seed of [0,37,741]){
    const s=C.fresh('birdblast',level,seed,mode);assert.deepEqual(s,C.fresh('birdblast',level,seed,mode));invariant(s);
    assert.equal(C.groups(s).length,0);assert.equal(s.phase,'playing');assert(C.hint(s));
    assert.equal(s.timeLeft,mode==='pandora'||mode==='fever'?120:null);
    assert.equal(s.riseLeft,mode==='classic'?18:null);
    assert.equal(s.covers.reduce((a,b)=>a+b,0),mode==='ice'?4+level:0);
  }
});

test('Bird movement: only column tops move, destination means column, and rearranging is allowed',()=>{
  const s=C.fresh('birdblast',0,37),saved=clone(s),source=C.top(s,0);
  assert.equal(C.play(s,source+7,1).ok,false);assert.deepEqual(s,saved,'buried birds cannot be moved');
  assert.equal(C.play(s,source,source%7).ok,false);assert.deepEqual(s,saved,'same-column drops do not consume actions');
  assert.equal(C.play(s,source,-1).ok,false);assert.deepEqual(s,saved);
  assert.equal(C.play(s,source,49).ok,false);assert.deepEqual(s,saved);
  let rearranged=false;
  for(let col=0;col<7&&!rearranged;col++)for(let target=0;target<7&&!rearranged;target++){
    const next=clone(saved),a=C.top(next,col),uid=next.board[a].uid,event=C.play(next,a,42+target);
    if(event.ok&&event.total===0){assert.equal(next.movesUsed,1);assert.equal(next.score,0);assert.equal(next.board[C.top(next,target)].uid,uid);invariant(next);rearranged=true;}
  }
  assert(rearranged,'a rearranging move does not require an immediate match');
  const full=C.fresh('birdblast',0,37,'classic');
  for(let row=0;row<7;row++)full.board[row*7+1]={uid:full.nextId++,kind:'normal',color:row%3,special:''};
  const before=clone(full);assert.equal(C.play(full,C.top(full,0),1).ok,false);assert.deepEqual(full,before,'full columns reject a drop');
});

test('Bird groups: orthogonal shapes clear, four special tiers survive creation and activate later',()=>{
  // This L consists of the two adjacent bottom birds and the bird dropped above.
  const l=fixture(3);l.s.board[38]=null;l.put(44);l.put(37,1);
  // Column 2's blue top keeps its red bottom adjacent to column 3's red bottom.
  assert.equal(C.groups(l.s).length,0);const event=C.play(l.s,...l.move);assert(event.ok);assert.equal(event.frames[1].removed.length,3);
  for(const [count,special]of [[4,'glow'],[5,'fire'],[6,'lightning'],[7,'whirlwind']]){
    const {s,move}=fixture(count),uid=s.board[move[0]].uid;assert.equal(C.groups(s).length,0);
    const result=C.play(s,...move),clear=result.frames.find(f=>f.kind==='clear');
    assert(result.ok);assert.deepEqual(clear.triggered,[],'creating a special is not activating it');
    assert.deepEqual(clear.created,[{index:31,special}]);assert.equal(clear.removed.length,count-1);
    assert.equal(s.board.find(t=>t?.uid===uid).special,special,'creation anchor survives both blast and gravity');
    assert.equal(clear.stats.score,(count-1)*10);assert.equal(clear.stats.collected[0],count-1);
    invariant(s);

    const later=fixture(4);later.s.board[30].special=special;
    const activation=C.play(later.s,...later.move),trigger=activation.frames.find(f=>f.kind==='clear');
    assert(trigger.triggered.some(t=>t.special===special));assert.equal(trigger.triggered.filter(t=>t.special===special).length,1);
    assert(!later.s.board.some(t=>t?.uid===trigger.board[30].uid),'matched old special is consumed');
    assert(later.s.board.filter(Boolean).length>=14||later.s.phase==='won','big blasts replenish an untimed board');invariant(later.s);
  }
  const lone=fixture(3);lone.s.board[20].special='whirlwind';const old=clone(lone.s);assert.equal(C.play(lone.s,20).ok,false);assert.deepEqual(lone.s,old,'specials cannot be activated by tapping alone');
});

test('Bird special chains trigger once per tile and frozen birds thaw from adjacent clears',()=>{
  const {s,move}=fixture(7);s.board[30].special='fire';s.board[32].special='lightning';s.board[41].special='glow';
  const result=C.play(s,...move),triggers=result.frames.flatMap(f=>f.triggered.map(t=>f.board[t.index].uid));
  assert.equal(new Set(triggers).size,triggers.length);assert.equal(triggers.length,3);invariant(s);
  const frozen=fixture(3,'ice');
  frozen.s.clearedCovers=frozen.s.goals.covers-1;frozen.s.covers[41]=1;const frozenUid=frozen.s.board[41].uid;
  // Put the frozen bird beside the column being cleared, retaining a compact stack.
  frozen.s.board[40]=frozen.s.board[41];frozen.s.board[47]=frozen.s.board[48];frozen.s.board[41]=null;frozen.s.board[48]=null;frozen.s.covers[41]=0;frozen.s.covers[40]=1;
  // Keep the moving source at column 6 top with supports after relocating its base.
  for(const i of [41,48])frozen.put(i,4);
  const before=clone(frozen.s);assert.equal(C.play(frozen.s,40,0).ok,false);assert.deepEqual(frozen.s,before,'frozen column top cannot be dragged');
  // Move the ice to column 4, next to red column 3 at row 5.
  frozen.s.board[39]=frozen.s.board[40];frozen.s.board[46]=frozen.s.board[47];frozen.s.board[40]=null;frozen.s.board[47]=null;frozen.s.covers[40]=0;frozen.s.covers[39]=1;
  const cleared=C.play(frozen.s,...frozen.move);assert(cleared.ok);assert.equal(frozen.s.clearedCovers,frozen.s.goals.covers);
  assert(frozen.s.board.some(t=>t?.uid===frozenUid),'adjacent clear removes ice while retaining the bird');assert.equal(frozen.s.phase,'won');invariant(frozen.s);
});

test('Bird stages are achievable through legal top moves, with free shuffle available for difficult arrangements',()=>{
  for(const mode of ['practice','ice'])for(let level=0;level<12;level++)for(const seed of [0,3,7,19]){
    const s=C.fresh('birdblast',level,seed,mode);let dry=0,lastScore=-1;
    for(let step=0;step<240&&s.phase==='playing';step++){
      dry=s.score===lastScore?dry+1:0;lastScore=s.score;if(dry===8){C.shuffle(s);dry=0;}
      const saved=clone(s),move=C.hint(s);assert.deepEqual(s,saved,'asking for a hint is a pure read');assert(move);
      const action=C.play(s,...move);assert(action.ok);assert(action.frames.length>0);invariant(s);
    }
    assert.equal(s.phase,'won',`${mode} level ${level+1} seed ${seed}`);
    const won=clone(s);assert.equal(C.play(s,0,1).ok,false);C.tick(s,1);assert.deepEqual(s,won);
  }
});

test('Bird shuffle keeps bird identities, specials, ice, goals and progression',()=>{
  const s=C.fresh('birdblast',5,37,'ice');s.board[C.top(s,0)].special='fire';
  const before=clone(s),result=C.shuffle(s);assert(result.ok);assert.equal(result.frames[0].kind,'shuffle');
  const pieces=board=>board.filter(Boolean).sort((a,b)=>a.uid-b.uid);
  assert.deepEqual(pieces(s.board),pieces(before.board));assert.deepEqual(s.covers,before.covers);
  for(const key of ['score','movesUsed','movesLeft','collected','clearedCovers','goals','timeLeft'])assert.deepEqual(s[key],before[key]);
  for(let i=0;i<49;i++)if(s.covers[i])assert.deepEqual(s.board[i],before.board[i]);
  assert(C.hint(s));assert.equal(C.groups(s).length,0);invariant(s);
});

test('Bird classic rises and tops out; timed modes expire, tokens reward, and fever combos cool down',()=>{
  const classic=C.fresh('birdblast',0,37,'classic');const before=clone(classic);for(let i=0;i<17;i++)assert.equal(C.tick(classic,1).frames.length,0);
  assert.equal(classic.riseLeft,1);const rise=C.tick(classic,1);assert(rise.frames.some(f=>f.kind==='rise'));assert.equal(classic.movesUsed,0);assert.equal(before.board.filter(Boolean).length+7,rise.frames.find(f=>f.kind==='rise').board.filter(Boolean).length);invariant(classic);
  const full=C.fresh('birdblast',0,37,'classic');for(let row=0;row<7;row++)full.board[row*7]={uid:full.nextId++,kind:'normal',color:row%3,special:''};full.riseLeft=.5;
  C.tick(full,.5);assert.equal(full.phase,'lost');invariant(full);
  const hard=C.fresh('birdblast',0,37,'classic');hard.score=100000;hard.riseLeft=.5;C.tick(hard,.5);assert.equal(hard.riseLeft,6,'classic rise accelerates to a bounded minimum');
  for(const mode of ['pandora','fever']){
    const s=C.fresh('birdblast',0,37,mode);for(let i=0;i<119;i++)C.tick(s,1);assert.equal(s.phase,'playing');assert.equal(s.timeLeft,1);
    C.tick(s,1);assert.equal(s.phase,'won');assert.equal(s.timeLeft,0);invariant(s);
  }
  const token=fixture(3,'pandora');token.s.board[38].kind='token';const tokenResult=C.play(token.s,...token.move);
  assert.equal(tokenResult.frames.find(f=>f.kind==='clear').tokens,1);assert.equal(token.s.score,80);assert.equal(token.s.timeLeft,122);invariant(token.s);
  const fever=fixture(3,'fever');fever.s.combo=3;fever.s.comboLeft=4;C.play(fever.s,...fever.move);assert.equal(fever.s.score,120);assert.equal(fever.s.combo,4);for(let i=0;i<4;i++)C.tick(fever.s,1);assert.equal(fever.s.combo,0);assert.equal(fever.s.comboLeft,0);invariant(fever.s);
});

test('Bird restore rejects malformed boards, impossible counters and unsupported modes',()=>{
  const original=C.fresh('birdblast',2,37,'practice');
  for(const mutate of [s=>s.board.push(null),s=>s.board[48].uid=s.board[47].uid,s=>s.board[48].color=99,s=>s.board[48].special='unknown',s=>s.covers[0]=1,s=>s.rng=-1,s=>s.goals.score=1,s=>s.timeLeft=120,s=>s.movesLeft=30,s=>s.mode='unknown',s=>s.phase='won',s=>s.board[48]=null]){
    const broken=clone(original);mutate(broken);const restored=C.restore('birdblast',broken);assert.equal(restored.level,0);assert.equal(restored.mode,'practice');assert.equal(restored.phase,'playing');invariant(restored);
  }
});
