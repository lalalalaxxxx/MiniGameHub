const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../games/colormix/core.js');

test('paint recipes are commutative, distinguish light from pigment, and cover the whole collection', () => {
  for (const [a,b,result] of [['red','yellow','orange'],['yellow','blue','green'],['blue','red','purple']]) {
    assert.equal(C.mix([a,b]).id,result);
    assert.deepEqual(C.mix([a,b]),C.mix([b,a]));
    assert.equal(C.mix([a,a,b,b]).hex,C.mix([a,b]).hex);
  }
  assert.equal(C.mix(['red','yellow','blue']).id,'brown');
  assert.equal(C.mix(['red','red']).id,'red');
  assert.equal(C.mix([]),null);assert.equal(C.mix(['orange']),null);
  const s=C.fresh();s.mode='lab';
  for(const [id,recipe] of Object.entries(C.recipes)) {
    s.rounds.lab.drops=[...recipe];assert.equal(C.stir(s).id,id);
    if(id!=='white'){s.rounds.lab.drops.push('white');assert.equal(C.stir(s).id,'light-'+id);}
  }
  assert.equal(Object.keys(s.book).length,15);
  assert.deepEqual(C.restore(JSON.parse(JSON.stringify(s))),s);
  for(const base of ['red','blue','purple']){
    const values=[0,1,2,3].map(n=>C.mix([...C.recipes[base],...Array(n).fill('white')]).hex.match(/[0-9a-f]{2}/g).map(v=>parseInt(v,16)));
    for(let i=1;i<4;i++)for(let c=0;c<3;c++)assert(values[i][c]>values[i-1][c]);
  }
});

test('every order, town object, detective puzzle and exact shade is reachable through legal actions',()=>{
  const s=C.fresh();
  for(const mode of ['shop','town','detective','shades']){
    s.mode=mode;
    for(let level=0;level<C.modes[mode].count;level++){
      const r=s.rounds[mode];assert.equal(r.level,level);
      for(let patch=0;patch<(mode==='town'?6:1);patch++){
        if(mode==='town')assert(C.selectPatch(s,patch));
        const target=C.task(s),remaining=[...target.drops];
        for(const c of r.drops)remaining.splice(remaining.indexOf(c),1);
        assert.equal(C.apply(s),false,'cannot win before mixing');
        for(const c of remaining)assert(C.add(s,c),`${mode} ${level}: ${c}`);
        assert(C.stir(s));assert(C.matches(s));assert(C.apply(s));
        assert.equal(C.apply(s),false,'repeated apply cannot add progress');
      }
      assert(r.won);assert.equal(C.add(s,'red'),false);assert.equal(C.undo(s),false);
      assert.deepEqual(C.restore(JSON.parse(JSON.stringify(s))),s,'completed progress survives a reload');
      assert.equal(C.next(s),level<C.modes[mode].count-1);
    }
  }
});

test('wrong mixtures stay retryable, known pigments stay fixed, and experiments have a drop limit',()=>{
  const s=C.fresh();C.add(s,'blue');C.add(s,'blue');C.stir(s);
  assert.equal(C.apply(s),false);assert.equal(s.rounds.shop.level,0);
  C.reset(s);C.add(s,'red');C.add(s,'yellow');C.stir(s);assert(C.apply(s));
  s.mode='detective';assert.equal(C.undo(s),false);C.add(s,'blue');C.reset(s);assert.deepEqual(s.rounds.detective.drops,['red']);
  s.mode='shades';C.add(s,'white');C.add(s,'white');C.stir(s);assert.equal(C.apply(s),false);
  C.undo(s);assert.equal(C.apply(s),false,'changing the recipe requires stirring again');C.stir(s);assert(C.apply(s));
  s.mode='lab';for(let i=0;i<8;i++)assert(C.add(s,'red'));assert.equal(C.add(s,'blue'),false);
  assert(C.stir(s).discovered);assert.equal(C.stir(s).discovered,false);assert(C.undo(s));
});

test('corrupt, incompatible and forged saves cannot inject colors or completed rounds',()=>{
  for(const input of [null,{},[],{version:2}])assert.deepEqual(C.restore(input),C.fresh());
  const bad={version:1,mode:'__proto__',rounds:{shop:{level:999,won:true},lab:{level:0,drops:['<img>'],mixed:true},shades:{level:0,drops:['blue','white'],mixed:true,won:true},town:{level:0,painted:[0,0,-1,6,'1'],patch:7}},book:{red:['blue'],green:['red','blue']}};
  const s=C.restore(bad);assert.equal(s.mode,'shop');assert.equal(s.rounds.shop.level,0);assert.equal(s.rounds.shades.won,false);
  assert.deepEqual(s.rounds.shades.drops,['red']);assert.deepEqual(s.rounds.lab.drops,[]);assert.deepEqual(s.rounds.town.painted,[0]);assert.deepEqual(s.book,{});
});
