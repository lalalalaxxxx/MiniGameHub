'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../games/pvz/core');
const {setup}=require('./helpers/extra-browser.cjs');
async function boot(h,state){await h.page.goto(h.base+'games/pvz/index.html',{waitUntil:'domcontentloaded'});if(state)await h.page.evaluate(s=>{localStorage.setItem('childgame.pvz.v1',JSON.stringify(s));localStorage.setItem('childgame.pvz.profile.v1',JSON.stringify({unlocked:s.level,coins:0}));},state);await h.page.goto(h.base+'games/pvz/index.html',{waitUntil:'domcontentloaded'});await h.page.waitForFunction(()=>window.PVZGame?.ready());if(state){await h.page.locator('#continue').tap();await h.page.waitForFunction(()=>PVZGame.ready()&&PVZGame.snapshot().level===JSON.parse(localStorage.getItem('childgame.pvz.v1')).level);await h.page.locator('#pause').tap();}}
async function point(h,row,col){const r=await h.page.locator('#board').boundingBox(),p=await h.page.evaluate(([r,c])=>PVZGame.point(r,c),[row,col]);return {x:r.x+p.x/1100*r.width,y:r.y+p.y/700*r.height};}
async function tap(h,row,col){const p=await point(h,row,col);await h.page.touchscreen.tap(p.x,p.y);}
const snap=h=>h.page.evaluate(()=>PVZGame.snapshot());
function fixture(level,deck){const s=C.fresh(level,42,deck);C.start(s);s.sun=2000;s.waveIn=10000;s.graves=[];return s;}

test('PvZ touch: first level, genuine projectile combat, win reward and automatic next level',{timeout:120000},async()=>{
 const h=await setup();try{await h.page.clock.install();await boot(h);await h.page.locator('#adventure').tap();await h.page.waitForFunction(()=>!PVZGame.paused());await h.page.locator('#cards [data-plant=peashooter]').tap();await tap(h,2,1);assert.equal((await snap(h)).plants.length,1);assert.equal((await snap(h)).sun,50);
 await h.page.clock.runFor(23000);assert((await snap(h)).zombies.length);assert.equal(await h.page.evaluate(()=>PVZGame.effects().contextLost),false);const pixel=await h.page.evaluate(()=>Array.from(document.getElementById('board').getContext('2d').getImageData(220,210,1,1).data));assert(pixel[1]>pixel[0],'lawn is visibly rendered');await h.capture('pvz-day');
 for(let n=0;n<90&&(await snap(h)).phase==='running';n++)await h.page.clock.runFor(1000);assert.equal((await snap(h)).phase,'won');assert.equal(await h.page.locator('#result').isVisible(),true);assert.equal(await h.page.evaluate(()=>GameUX.transitioning()),true);
 await h.page.clock.runFor(5500);await h.page.waitForFunction(()=>PVZGame.ready()&&PVZGame.snapshot().level===2);assert.equal((await snap(h)).phase,'running');assert((await snap(h)).deck.includes('sunflower'));
 }finally{await h.close();}
});

test('PvZ dense pool stays rendered with bounded effects and pauses work in background',{timeout:60000},async t=>{
 const h=await setup();try{
  await h.page.addInitScript(()=>{window.pvzRenderCosts=[];Object.defineProperty(window,'createPVZRenderer',{configurable:true,set(fn){Object.defineProperty(window,'createPVZRenderer',{value:function(...args){const r=fn(...args),draw=r.draw;r.draw=(...a)=>{const start=performance.now();draw(...a);if(pvzRenderCosts.length<400)pvzRenderCosts.push(performance.now()-start);};return r;}});}});});
  const s=fixture(29,['lilypad','sunflower','repeater','torchwood','wallnut','snowpea']);
  for(let row=0;row<6;row++)for(const [type,col] of [['sunflower',0],['repeater',2],['torchwood',4],['wallnut',6]]){s.sun=9990;if(C.water(s,row)){s.cooldowns.lilypad=0;assert(C.plantAt(s,'lilypad',row,col));}s.cooldowns[type]=0;assert(C.plantAt(s,type,row,col));}
  for(let row=0;row<6;row++)for(let n=0;n<6;n++)C.spawn(s,C.water(s,row)?['ducky1','ducky2','ducky3'][n%3]:['zombie','cone','bucket'][n%3],row,7+n*.35);
  await boot(h,s);
  if(h.engine.name()==='chromium'){const cdp=await h.page.context().newCDPSession(h.page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  await h.page.waitForTimeout(4000);const report=await h.page.evaluate(()=>{const samples=pvzRenderCosts.slice(5).sort((a,b)=>a-b);return {...PVZGame.effects(),samples:samples.length,p95:samples[Math.floor(samples.length*.95)],median:samples[Math.floor(samples.length*.5)]};});
  assert.equal(report.contextLost,false);assert(report.particles<=100);assert(report.deaths<=32);assert(report.atlasBytes<100*1024*1024);assert(report.samples>20);assert(report.p95<60,JSON.stringify(report));t.diagnostic(JSON.stringify(report));await h.capture('pvz-dense-pool');
  await h.page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await h.page.evaluate(()=>PVZGame.effects().raf),false);
 }finally{await h.close();}
});
test('PvZ touch: drag planting, second finger isolation, cancellation, sun and shovel',{timeout:60000},async()=>{
 const h=await setup();try{const s=fixture(9,['peashooter','sunflower']);s.suns=[{id:s.nextId++,x:3.5,y:1,toY:1,value:25,age:0}];await boot(h,s);const b=await h.page.locator('#cards [data-plant=peashooter]').boundingBox(),p=await point(h,2,3);
 await h.page.mouse.move(b.x+b.width/2,b.y+b.height/2);await h.page.mouse.down();await h.page.mouse.move(p.x,p.y,{steps:5});await h.page.evaluate(()=>document.getElementById('stage').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:52,pointerType:'touch',clientX:0,clientY:0})));
 assert.equal((await snap(h)).plants.length,0);await h.page.mouse.up();assert.equal((await snap(h)).plants.length,1);
 await h.page.locator('#shovel').tap();await tap(h,2,3);assert.equal((await snap(h)).plants.length,0);
 const before=(await snap(h)).sun;await tap(h,1,3);assert.equal((await snap(h)).sun,before+25);
 await h.page.locator('#cards [data-plant=sunflower]').tap();const q=await point(h,1,1);await h.page.mouse.move(q.x,q.y);await h.page.mouse.down();await h.page.evaluate(()=>document.getElementById('stage').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1})));await h.page.mouse.up();assert.equal((await snap(h)).plants.length,0);await tap(h,1,1);assert.equal((await snap(h)).plants.length,1);
 }finally{await h.close();}
});
test('PvZ pauses timers, audio and animation in tools; refresh preserves running save paused',{timeout:60000},async()=>{
 const h=await setup();try{await h.page.clock.install();await boot(h,fixture(9,['peashooter']));await h.page.locator('#cards [data-plant=peashooter]').tap();await tap(h,2,2);await h.page.clock.runFor(700);await h.page.locator('#game-more').tap();const before=await snap(h);await h.page.clock.runFor(6000);assert.deepEqual(await snap(h),before);assert.equal(await h.page.evaluate(()=>PVZGame.effects().raf),false);await h.page.locator('#game-tools-close').tap();assert.equal(await h.page.evaluate(()=>PVZGame.paused()),false);
 await h.page.locator('#pause').tap();const paused=await snap(h);await h.page.reload();await h.page.waitForFunction(()=>PVZGame.ready());await h.page.locator('#continue').tap();await h.page.waitForFunction(()=>PVZGame.ready());assert.equal(await h.page.evaluate(()=>PVZGame.paused()),true);assert.deepEqual(await snap(h),paused);await h.page.clock.runFor(3000);assert.deepEqual(await snap(h),paused);
 await h.page.locator('#pause').tap();await h.page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await h.page.evaluate(()=>PVZGame.effects().raf),false);
 }finally{await h.close();}
});
test('PvZ audio unlocks on first touch, plays music and effects, and stops in menu',{timeout:60000},async t=>{
 const h=await setup();try{
  if(!await h.page.evaluate(()=>!!window.AudioBufferSourceNode)){t.skip('This Windows WebKit build has no Web Audio; offline suite verifies media bytes.');return;}
  await h.page.addInitScript(()=>{window.pvzMusic=[];window.pvzSounds=0;const Native=window.Audio;window.Audio=class extends Native{constructor(...args){super(...args);pvzMusic.push(this);}};const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){pvzSounds++;return start.apply(this,args);};});
  await boot(h,fixture(9,['peashooter']));await h.page.waitForFunction(()=>audioDecoded>=15&&pvzMusic.some(a=>!a.paused&&a.currentTime>0));const before=await h.page.evaluate(()=>pvzSounds);await h.page.locator('#cards [data-plant=peashooter]').tap();await tap(h,2,2);await h.page.waitForFunction(n=>pvzSounds>n,before);
  await h.page.locator('#game-more').tap();assert.equal(await h.page.evaluate(()=>pvzMusic.every(a=>a.paused)),true);await h.page.locator('#sound').tap();await h.page.waitForFunction(()=>!GameUX.isMenuOpen());assert.equal(await h.page.evaluate(()=>pvzMusic.every(a=>a.paused)),true);
 }finally{await h.close();}
});

test('PvZ: pool touch layering, roof, fog, special stages and boss resources render',{timeout:120000},async()=>{
 const h=await setup();try{
  for(const level of [21,31,35,40,41,50]){const s=fixture(level,level===21?['lilypad','peashooter']:undefined);if(level===50)C.tick(s,.1);await boot(h,s);
   if(level===21){await h.page.locator('#cards [data-plant=lilypad]').tap();await tap(h,2,2);await h.page.locator('#cards [data-plant=peashooter]').tap();await tap(h,2,2);assert.equal((await snap(h)).plants.length,2);await h.capture('pvz-pool');}
   if(level===35){await tap(h,0,3);assert.equal((await snap(h)).vases.length,29);assert((await snap(h)).conveyor.length>0);}
   if(level===50){await h.capture('pvz-boss');assert((await snap(h)).zombies.some(z=>z.type==='boss'));const down=fixture(50);down.time=15;C.tick(down,.1);await boot(h,down);await h.capture('pvz-boss-down');}
   await h.page.locator('#pause').tap();
  }
 }finally{await h.close();}
});
test('PvZ: all tablet orientations fit and menus retain finger-sized targets',{timeout:60000},async()=>{
 const h=await setup();try{await boot(h,fixture(9,['peashooter','sunflower','wallnut','potatomine','repeater','cherrybomb']));for(const viewport of [{width:1180,height:820},{width:1024,height:650},{width:768,height:1024},{width:820,height:560},{width:390,height:844}]){await h.page.setViewportSize(viewport);await h.page.waitForTimeout(100);const result=await h.page.evaluate(()=>{const r=document.getElementById('stage').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight};});assert(result.x>=-1&&result.y>=-1&&result.right<=viewport.width+1&&result.bottom<=viewport.height+1,JSON.stringify(result));assert(result.sw<=viewport.width&&result.sh<=viewport.height);await h.page.locator('#game-more').tap();assert(await h.page.locator('#game-tools').isVisible());await h.page.locator('#game-tools-close').tap();}
 }finally{await h.close();}
});

test('PvZ classic warning and headless animation render; pause and reload preserve the countdown',{timeout:60000},async()=>{
 const h=await setup();try{
  await h.page.clock.install();const s=fixture(9,['peashooter']);s.wave=9;s.waveIn=.05;
  const z=C.spawn(s,'zombie',2,5);z.hp=80;C.spawn(s,'cone',1,6);C.spawn(s,'bucket',3,6);
  await boot(h,s);await h.page.clock.runFor(500);const state=await snap(h);assert.equal(state.waveWarning,true);assert(state.zombies.some(z=>z.headless));assert.equal(state.wave,9);assert.equal(await h.page.evaluate(()=>PVZGame.effects().contextLost),false);await h.capture('pvz-classic-warning');
  await h.page.locator('#pause').tap();const paused=await snap(h);await h.page.clock.runFor(10000);assert.deepEqual(await snap(h),paused);
  await h.page.reload();await h.page.waitForFunction(()=>PVZGame.ready());await h.page.locator('#continue').tap();await h.page.waitForFunction(()=>PVZGame.ready());assert.deepEqual(await snap(h),paused);assert.equal(await h.page.evaluate(()=>PVZGame.paused()),true);
  await h.page.locator('#pause').tap();await h.page.clock.runFor(7500);assert.equal((await snap(h)).wave,10);assert.equal((await snap(h)).waveWarning,false);
 }finally{await h.close();}
});
