'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../assets/js/petlink-core.js');
function board(cols,rows,entries){const s={cols,rows,board:Array(cols*rows).fill(null),phase:'playing'};for(const [i,pet] of entries)s.board[i]={uid:i+1,pet};return s;}
function oracle(s,a,b){
  if(a===b||!s.board[a]||!s.board[b]||s.board[a].pet!==s.board[b].pet)return false;
  const width=s.cols+2,height=s.rows+2,start={x:a%s.cols+1,y:Math.floor(a/s.cols)+1},end={x:b%s.cols+1,y:Math.floor(b/s.cols)+1};
  const best=new Map(),queue=[{...start,dir:-1,turns:0}],dirs=[[1,0],[0,1],[-1,0],[0,-1]];
  for(let k=0;k<queue.length;k++){
    const p=queue[k];
    for(let dir=0;dir<4;dir++){
      const x=p.x+dirs[dir][0],y=p.y+dirs[dir][1],turns=p.turns+(p.dir>=0&&p.dir!==dir?1:0);
      if(turns>2||x<0||x>=width||y<0||y>=height)continue;
      if(x===end.x&&y===end.y)return true;
      if(x>0&&x<width-1&&y>0&&y<height-1&&s.board[(y-1)*s.cols+x-1])continue;
      const key=`${x},${y},${dir}`;if((best.get(key)??3)<=turns)continue;best.set(key,turns);queue.push({x,y,dir,turns});
    }
  }return false;
}
function legal(s,a,b,path){
  assert(path.length>=2&&path.length<=4);assert.deepEqual(path[0],C.point(s,a));assert.deepEqual(path.at(-1),C.point(s,b));
  for(let k=1;k<path.length;k++){
    const p=path[k-1],q=path[k];assert(p.x===q.x||p.y===q.y);
    const n=Math.abs(q.x-p.x)+Math.abs(q.y-p.y),dx=Math.sign(q.x-p.x),dy=Math.sign(q.y-p.y);
    for(let j=0;j<=n;j++){const x=p.x+dx*j,y=p.y+dy*j;assert(x>=-1&&x<=s.cols&&y>=-1&&y<=s.rows);if(x>=0&&x<s.cols&&y>=0&&y<s.rows){const i=y*s.cols+x;assert(i===a||i===b||!s.board[i]);}}
  }
}
test('Pet routes: straight, L, Z, blocked, unlike pets and outside U routes',()=>{
  let s=board(4,4,[[0,0],[3,0]]);assert.equal(C.route(s,0,3).length,2);
  s=board(4,4,[[0,0],[10,0]]);assert.equal(C.route(s,0,10).length,3);
  s=board(5,5,[[6,0],[18,0],[8,1],[16,1]]);assert.equal(C.route(s,6,18).length,4);legal(s,6,18,C.route(s,6,18));
  s=board(4,4,Array.from({length:16},(_,i)=>[i,i===0||i===3?0:1]));let p=C.route(s,0,3);assert.equal(p.length,4);assert(p.some(q=>q.y===-1));legal(s,0,3,p);
  s=board(4,4,Array.from({length:16},(_,i)=>[i,i===5||i===10?0:1]));assert.equal(C.route(s,5,10),null);assert.equal(C.route(s,5,6),null);assert.equal(C.route(s,5,5),null);
});
test('Pet route solver matches an independent directional BFS on random obstructed boards',()=>{
  let seed=91;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*n);};
  for(let round=0;round<180;round++){
    const s=board(6,5,Array.from({length:30},(_,i)=>[i,random(4)]).filter(()=>random(4)>0));
    for(let pair=0;pair<35;pair++){const a=random(30),b=random(30),path=C.route(s,a,b);assert.equal(!!path,oracle(s,a,b),`board ${round}, ${a}-${b}`);if(path)legal(s,a,b,path);}
  }
});
test('Pet flow keeps order and identity, moving only into empty squares',()=>{
  const source=board(4,3,[[0,0],[2,1],[5,2],[11,3]]);
  const expected={down:[8,10,9,11],up:[0,2,1,3],left:[0,1,4,8],right:[2,3,7,11]};
  for(const flow of Object.keys(expected)){const s=C.clone(source);C.shift(s,flow);const positions=[1,3,6,12].map(uid=>s.board.findIndex(t=>t?.uid===uid));assert.deepEqual(positions,expected[flow],flow);}
});
test('Pet campaigns: all 12 stages solve across 24 seeds, preserve exact saves and pet counts',()=>{
  let autos=0;
  for(let index=0;index<12;index++)for(let seed=0;seed<24;seed++){
    const s=C.fresh(index,seed,seed%2?'practice':'timed');assert.deepEqual(C.restore(s),s);
    let moves=0;
    while(s.phase==='playing'){
      const before=C.clone(s),hint=C.hint(s);assert(hint);assert.deepEqual(s,before,'hint is pure');legal(s,...hint.pair,hint.path);
      const result=C.play(s,...hint.pair);assert(result.ok);assert(result.frames.length>=2);assert.equal(s.board.filter(Boolean).length,before.board.filter(Boolean).length-2);
      const removed=hint.pair.map(i=>before.board[i].uid);assert.deepEqual(s.board.filter(Boolean).map(t=>t.uid).sort((a,b)=>a-b),before.board.filter(t=>t&&!removed.includes(t.uid)).map(t=>t.uid).sort((a,b)=>a-b));
      assert.deepEqual(C.restore(s),s,`save after stage ${index} seed ${seed} pair ${moves}`);C.tick(s,.25);moves++;assert(moves<=s.cols*s.rows/2);
    }
    assert.equal(s.phase,'won');assert.equal(s.pairs,s.cols*s.rows/2);assert.equal(s.board.filter(Boolean).length,0);autos+=s.autoShuffles;
  }assert(autos>0,'campaigns exercise automatic deadlock rescue');
});
test('Pet timer, combo, hint budgets, manual shuffle, invalid moves and malformed saves',()=>{
  const s=C.fresh(0,37);C.tick(s,10);assert.equal(s.timeLeft,90);
  let before=C.clone(s);assert(!C.play(s,0,0).ok);assert.deepEqual(s,before);
  for(let i=0;i<3;i++)assert(C.useHint(s));assert.equal(C.useHint(s),null);assert.equal(s.hintsLeft,0);
  for(let i=0;i<3;i++){before=C.clone(s);assert(C.shuffle(s).ok);assert.deepEqual(s.board.map(t=>t.uid).sort((a,b)=>a-b),before.board.map(t=>t.uid).sort((a,b)=>a-b));assert.equal(s.timeLeft,before.timeLeft);assert(C.hint(s));}
  assert(!C.shuffle(s).ok);before=C.clone(s);let hint=C.hint(s),result=C.play(s,...hint.pair);assert.equal(result.bonus,2);assert.equal(s.timeLeft,92);assert.equal(s.combo,1);
  hint=C.hint(s);result=C.play(s,...hint.pair);assert.equal(result.bonus,2.25);assert.equal(s.combo,2);C.tick(s,6);assert.equal(s.combo,0);
  C.tick(s,1000);assert.equal(s.phase,'lost');assert.equal(s.timeLeft,0);assert.deepEqual(C.restore(s),s);
  const practice=C.fresh(0,37,'practice');C.tick(practice,99999);assert.equal(practice.phase,'playing');assert.equal(practice.timeLeft,null);
  for(const mutate of [s=>s.board[0].pet=99,s=>s.board[1]=s.board[0],s=>s.board.pop(),s=>s.timeLeft=-1,s=>s.hintsLeft=9,s=>s.phase='won',s=>s.pairs=8,s=>s.cols=99,s=>s.rng=NaN]){const raw=C.fresh(0,37);mutate(raw);const restored=C.restore(raw);assert.equal(restored.phase,'playing');assert(C.hint(restored));assert.deepEqual(C.restore(restored),restored);}
});
