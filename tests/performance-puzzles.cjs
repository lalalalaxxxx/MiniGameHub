'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D=require('../assets/js/defense-core.js'),B=require('../assets/js/bird-core.js'),P=require('../assets/js/petlink-core.js');
const {setup}=require('./helpers/extra-browser.cjs');

// Captured from the pre-optimization rules: include every event and final saved state,
// so targeting ties, impact order, automatic breaks and RNG must remain identical.
test('puzzle performance core: dense defense trajectories preserve combat and automatic waves',()=>{
  const expected={gardenwatch:{easy:'fab3e766cbb3694ffbf4b22b2a8567a3807bf985dfab8109afb7bdc47f4e3b61',normal:'2c1aa71fa0bab6f97d82669b072cd29abb5fea2bc6592eac2848aa040bedc74d',hard:'67b0084293077ddbff888828452035fa6d6dfa901fa333bce5119ae294614223'},toydefense:{easy:'511a0fda03ea36639edc1e1b222f1f44376a04a50cfa16912e4cc708d6dc6031',normal:'c7e5a849af9c4519fc8f437cdc955ceaa1a0d6aa42713e117700d040dd77cdc8',hard:'d3a2fd7fe078a089b65e52efb3baa749afcbb90b47652def31a0d067c341cf65'}};
  for(const id of Object.keys(expected))for(const difficulty of Object.keys(expected[id])){
    const s=D.fresh(id,difficulty);s.coins=9999;
    for(let cell=0;cell<40;cell++)if(D.buildable(id,cell))D.build(s,cell,cell%3);
    for(const t of s.towers)t.level=3;D.start(s);
    const hash=crypto.createHash('sha256');
    for(let n=0;n<15000;n++){hash.update(JSON.stringify(D.tick(s,1/30)));if(s.phase==='lost'||s.phase==='won')break;}
    hash.update(JSON.stringify(s));assert.equal(hash.digest('hex'),expected[id][difficulty],id+' '+difficulty);
  }
});

test('puzzle performance core: cached Birzzle scans retain chains, supply, ice and Pandora RNG',()=>{
  const expected={classic:'0d0cd2f607eb44b047b056663f8e6b6ea7e56264cec51dd9ec887af5dfe5b552',ice:'3c46d3018460d93638963925e1c4a68e405d004f8ec05a69fcffe585e880cfe7',pandora:'9e0c9a9a60368c222613074296d69f48067726b7ba49d3d81664e26c3377f987',practice:'95e6841d82a12d21e467725cbe30cd13b03f325b65f1bf8e3190c042e95d5390',fever:'d6454691527afbe23956790e18da4715123bf1ca1c26a6e2539ac124a79c983f'};
  for(const mode of B.MODES){
    const s=B.fresh(mode,2026),hash=crypto.createHash('sha256');
    for(let n=0;n<5000&&s.phase==='playing';n++){
      if(n%45===0){const hint=B.hint(s);if(hint)hash.update(JSON.stringify(mode==='ice'?B.shoot(s,hint[1]%7):B.move(s,hint[0],hint[1])));}
      hash.update(JSON.stringify(B.tick(s,.025)));
    }
    hash.update(JSON.stringify(s));assert.equal(hash.digest('hex'),expected[mode],mode);
    assert.deepEqual(B.restore(s),s,'transient scan cache is absent from saves');
  }
});

function instrument(){
  window.puzzlePerf={frames:0,writes:0,gridPaints:0};
  const request=window.requestAnimationFrame,set=Storage.prototype.setItem,round=CanvasRenderingContext2D.prototype.roundRect;
  window.requestAnimationFrame=fn=>request(time=>{if(['frame','loop','tick','tickDraw'].includes(fn.name))puzzlePerf.frames++;fn(time);});
  Storage.prototype.setItem=function(...args){puzzlePerf.writes++;return set.apply(this,args);};
  CanvasRenderingContext2D.prototype.roundRect=function(...args){if(this.canvas.isConnected)puzzlePerf.gridPaints++;return round.apply(this,args);};
}
async function measured(page,ms=240){await page.evaluate(()=>{for(const key in puzzlePerf)puzzlePerf[key]=0;});await page.waitForTimeout(ms);return page.evaluate(()=>({...puzzlePerf}));}
async function hidden(page,value){await page.evaluate(value=>{if(value)Object.defineProperty(document,'hidden',{configurable:true,value:true});else delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));},value);}

test('puzzle performance: bird and defenses stop paused/hidden frames and resume one live simulation',{timeout:60000},async()=>{
  const h=await setup();
  try{
    await h.page.addInitScript(instrument);
    for(const id of ['birdblast','gardenwatch','toydefense']){
      await h.page.goto(h.base+`games/${id}/index.html`);await h.page.waitForTimeout(100);
      assert.equal((await measured(h.page)).frames,0,id+' initial screen has no game RAF');
      await h.page.locator(id==='birdblast'?'#resume':'#start').click();
      const running=await measured(h.page);assert(running.frames>0&&running.frames<40,id+' uses one simulation RAF');
      await h.page.locator('#pause').click();
      const saved=await h.page.evaluate(()=>window.BirdGame?.snapshot()||DefenseGame.snapshot());
      const stopped=await measured(h.page);assert.equal(stopped.frames,0,id+' pause');assert.equal(stopped.writes,0,id+' paused save');
      assert.deepEqual(await h.page.evaluate(()=>window.BirdGame?.snapshot()||DefenseGame.snapshot()),saved);
      await h.page.locator('#pause').click();await h.page.locator('#help').click();
      assert.equal((await measured(h.page)).frames,0,id+' help pauses RAF');
      await h.page.locator('#confirm').click();assert((await measured(h.page)).frames>0,id+' help resumes RAF');
      await hidden(h.page,true);assert.equal((await measured(h.page)).frames,0,id+' hidden');
      await hidden(h.page,false);assert.equal((await measured(h.page)).frames,0,id+' waits for deliberate resume');
      await h.page.locator('#pause').click();assert((await measured(h.page)).frames>0,id+' visible resume');
    }
  }finally{await h.close();}
});

test('puzzle performance: aquarium retains full swimming but suspends edit/help/hidden work',{timeout:40000},async()=>{
  const h=await setup();
  try{
    await h.page.addInitScript(instrument);await h.page.goto(h.base+'games/aquarium/index.html');
    for(const type of [2,3,4,5,6,7])await h.page.locator(`[data-action=add-fish][data-value="${type}"]`).click();
    await h.page.locator('[data-action=feed]').click();
    const before=await h.page.evaluate(()=>CozyGame.aquarium());assert.equal(before.animals.length,8);
    assert((await measured(h.page)).frames>0);
    const after=await h.page.evaluate(()=>CozyGame.aquarium());assert(after.animals.some((a,i)=>a.x!==before.animals[i].x||a.y!==before.animals[i].y),'animals move at full frame rate');
    await h.page.locator('[data-action=edit-tank]').click();
    const edited=await h.page.evaluate(()=>CozyGame.aquarium());assert.equal((await measured(h.page)).frames,0,'editing stops RAF');
    assert.deepEqual(await h.page.evaluate(()=>CozyGame.aquarium()),edited,'food and swimming freeze together');
    await h.page.locator('[data-action=edit-tank]').click();assert((await measured(h.page)).frames>0);
    await h.page.locator('#help').click();assert.equal((await measured(h.page)).frames,0,'help stops RAF');
    await h.page.locator('#confirm').click();assert((await measured(h.page)).frames>0);
    await hidden(h.page,true);assert.equal((await measured(h.page)).frames,0);
    await hidden(h.page,false);const resumed=await measured(h.page);assert(resumed.frames>0&&resumed.frames<40,'one aquarium RAF after visibility restore');
  }finally{await h.close();}
});

test('puzzle performance: practice pets stay idle, cached scenery animates and fruit selections retain tiles',{timeout:40000},async()=>{
  const h=await setup();
  try{
    await h.page.addInitScript(instrument);await h.page.goto(h.base+'index.html');
    await h.page.evaluate(s=>localStorage.setItem('childgame.petlink.v1',JSON.stringify(s)),P.fresh(0,37,'practice'));
    await h.page.goto(h.base+'games/petlink/index.html');await h.page.waitForTimeout(150);
    const quiet=await measured(h.page,2100);assert.equal(quiet.frames,0);assert.equal(quiet.writes,0,'practice has no recurring save');
    assert.equal(await h.page.evaluate(()=>PetLinkGame.scheduling().clock),false,'practice has no idle combo timer');
    const state=await h.page.evaluate(()=>PetLinkGame.snapshot()),pair=P.hint(state).pair;
    for(const i of pair)await h.page.locator(`[data-cell="${i}"]`).click();
    const animated=await measured(h.page);assert(animated.frames>0,'pet link and burst animate');assert.equal(animated.gridPaints,0,'static rounded scenery is cached');
    await h.page.waitForFunction(()=>!PetLinkGame.busy());assert.equal(await h.page.evaluate(()=>PetLinkGame.snapshot().pairs),1);
    assert.equal(await h.page.evaluate(()=>PetLinkGame.scheduling().clock),true,'combo countdown starts after pairing');
    await h.page.waitForFunction(()=>PetLinkGame.snapshot().combo===0,null,{timeout:7000});
    assert.equal(await h.page.evaluate(()=>PetLinkGame.scheduling().clock),false,'combo expiry returns to idle');
    await h.page.goto(h.base+'games/fruitgarden/index.html');
    await h.page.evaluate(()=>window.retainedFruit=document.querySelector('[data-action=tile]'));
    await h.page.locator('[data-action=tile]').first().click();await h.page.locator('[data-action=hint]').click();
    assert(await h.page.evaluate(()=>retainedFruit===document.querySelector('[data-action=tile]')),'selection and hint preserve tile DOM and current animations');
  }finally{await h.close();}
});

test('puzzle performance: demand clocks survive mode changes, drag, animation, help and garden return',{timeout:60000},async()=>{
  const h=await setup();
  try{
    await h.page.goto(h.base+'games/candyland/index.html');
    const ticking=()=>h.page.evaluate(()=>MatchGame.scheduling().clock);
    assert.equal(await ticking(),false,'untimed levels have no interval');
    await h.page.locator('#levels').selectOption('7');await h.page.locator('#confirm').click();assert.equal(await ticking(),true);
    await h.page.locator('[data-cell="0"]').dispatchEvent('pointerdown',{pointerId:71,isPrimary:true,button:0,clientX:50,clientY:50});
    assert.equal(await ticking(),false,'clock does not poll during a held drag');
    await h.page.locator('[data-cell="0"]').dispatchEvent('pointercancel',{pointerId:71,isPrimary:true});assert.equal(await ticking(),true,'cancelled drag wakes the clock');
    const hint=await h.page.evaluate(()=>MatchCore.hint(MatchGame.snapshot()));
    for(const cell of hint)await h.page.locator(`[data-cell="${cell}"]`).click();
    assert(await h.page.evaluate(()=>MatchGame.busy()));assert.equal(await ticking(),false,'animation pauses clock work');
    await h.page.waitForFunction(()=>!MatchGame.busy());assert.equal(await ticking(),true,'animation completion wakes timer');
    const time=await h.page.evaluate(()=>MatchGame.snapshot().timeLeft);await h.page.waitForFunction(time=>MatchGame.snapshot().timeLeft<time-.1,time);
    await h.page.locator('#help').click();assert.equal(await ticking(),false);await h.page.locator('#confirm').click();
    // Native dialog.close() queues its close event; wait for that lifecycle callback.
    await h.page.waitForFunction(()=>MatchGame.scheduling().clock,null,{timeout:2000});assert.equal(await ticking(),true);
    await h.page.locator('#pause').click();assert.equal(await ticking(),false);await h.page.locator('#pause').click();assert.equal(await ticking(),true);
    await hidden(h.page,true);assert.equal(await ticking(),false);await hidden(h.page,false);assert.equal(await ticking(),false);
    await h.page.locator('#pause').click();assert.equal(await ticking(),true);
    await h.page.locator('#levels').selectOption('0');await h.page.locator('#confirm').click();assert.equal(await ticking(),false);

    await h.page.goto(h.base+'games/fruitgarden/index.html');
    const growing=()=>h.page.evaluate(()=>CozyGame.scheduling().garden);
    assert.equal(await growing(),false);await h.page.locator('[data-action=tab][data-value=garden]').first().click();assert.equal(await growing(),false,'empty garden has no timer');
    await h.page.locator('[data-action=plant][data-value="0"]').click();assert.equal(await growing(),true);
    await h.page.locator('#help').click();assert.equal(await growing(),false);await h.page.locator('#confirm').click();await h.page.waitForFunction(()=>CozyGame.scheduling().garden,null,{timeout:2000});assert.equal(await growing(),true);
    await h.page.locator('[data-action=tab][data-value=puzzle]').first().click();assert.equal(await growing(),false);
    await h.page.locator('[data-action=tab][data-value=garden]').first().click();assert.equal(await growing(),true);
    await h.page.clock.install();await hidden(h.page,true);assert.equal(await growing(),false);
    await h.page.clock.fastForward(125000);await hidden(h.page,false);
    assert(await h.page.locator('[data-action=harvest][data-value="0"]').isVisible(),'growth is recovered from timestamps after returning');
    assert.equal(await growing(),false,'fully grown garden returns to idle');
  }finally{await h.close();}
});
