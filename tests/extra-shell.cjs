'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./helpers/extra-browser.cjs');
const ids=['zumapath','slingblocks','tripletown','tankguard','bombergarden','waterworks','trafficpark','fireice','buildracer','mushroomwar'];
const game=id=>require('../assets/js/extras/'+id+'.js');
test('Extra shell: ten games fit five tablet/phone sizes; lifecycle, audio and saves',{timeout:180000},async()=>{
 const h=await setup(),{page,snap,install}=h;
 try{for(const id of ids){
  await install(game(id).create(9,37));
  for(const size of [{width:1024,height:650},{width:820,height:560},{width:768,height:500},{width:768,height:1024},{width:390,height:844}]){
   await page.setViewportSize(size);await page.waitForTimeout(70);
   const r=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,board:document.querySelector('#board').getBoundingClientRect().toJSON(),bad:[...document.querySelectorAll('button,a,select')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).filter(e=>{const r=e.getBoundingClientRect(),side=e.closest('.side')?.getBoundingClientRect(),overlay=e.closest('.overlay')?.getBoundingClientRect();return r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1||r.height<43||(side&&r.bottom>side.bottom-2)||(overlay&&r.bottom>overlay.bottom);}).map(e=>e.id||e.textContent)}));
   assert(r.sw<=r.w+1&&r.sh<=r.h+1,JSON.stringify(r));assert.deepEqual(r.bad,[],id+' '+size.width+'x'+size.height);assert(r.board.width>240,id+' playable canvas');
  }
  await page.setViewportSize({width:1024,height:650});await page.locator('#resume').tap();await page.waitForTimeout(140);assert(!(await page.evaluate(()=>ExtraGame.paused())));await page.locator('#hint').tap();assert((await page.locator('#feedback').textContent()).length>0);
  await page.locator('#pause').tap();const frozen=await snap();await page.waitForTimeout(140);assert.deepEqual(await snap(),frozen);await page.reload();assert.deepEqual(await snap(),frozen);assert(await page.evaluate(()=>ExtraGame.paused()));
  await page.locator('#resume').tap();await page.locator('#help').tap();const help=await snap();await page.waitForTimeout(100);assert.deepEqual(await snap(),help);await page.locator('#confirm').tap();
  await page.locator('#levels').selectOption('0');await page.locator('#cancel').tap();assert.equal((await snap()).level,9);await page.locator('#levels').selectOption('0');await page.locator('#confirm').tap();assert.equal((await snap()).level,0);
  await page.locator('#resume').tap();await page.locator('#restart').tap();await page.locator('#confirm').tap();assert.equal((await snap()).moves,0);assert(await page.evaluate(()=>ExtraGame.paused()));
  await page.locator('#resume').tap();if(await page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext))){await page.waitForFunction(()=>audioDecoded===12);await page.waitForFunction(()=>document.querySelector('#sound').dataset.audioState==='on');await page.locator('#sound').tap();assert.equal(await page.locator('#sound').getAttribute('data-audio-state'),'off');await page.locator('#sound').tap();await page.waitForFunction(()=>document.querySelector('#sound').dataset.audioState==='on');}
  await h.capture(id);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});const hidden=await snap();await page.waitForTimeout(100);assert.deepEqual(await snap(),hidden);assert(!(await page.evaluate(()=>ExtraGame.effects().raf)));console.log('PASS extra shell '+id);
 }}finally{await h.close();}
});
test('Extra shell: undo, cancelled/secondary pointers and corrupted saves',{timeout:30000},async()=>{
 const h=await setup(),{page,install,snap}=h;
 try{
  await install(game('tripletown').create(0,37));await page.locator('#resume').tap();const before=await snap();await h.tap({x:100,y:420});assert((await snap()).moves>before.moves);await page.locator('#undo').tap();assert.deepEqual((await snap()).board,before.board);await page.reload();assert.deepEqual((await snap()).board,before.board);
  await install(game('slingblocks').create(0,37));await page.locator('#resume').tap();await page.evaluate(()=>{const el=document.querySelector('#board'),r=el.getBoundingClientRect();for(const [type,id,x,y,primary]of [['pointerdown',11,145,578,true],['pointerdown',12,350,300,false],['pointerup',12,600,300,false],['pointermove',11,70,630,true],['pointercancel',11,70,630,true]])el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:primary,button:0,clientX:r.x+x/720*r.width,clientY:r.y+y/800*r.height}));});assert.equal((await snap()).moves,0);assert.equal((await snap()).ball,null);
  await h.drag({x:145,y:578},{x:65,y:615});assert.equal((await snap()).moves,1);await page.locator('#pause').tap();const flight=await snap();await page.reload();assert.deepEqual(await snap(),flight);await page.locator('#resume').tap();await page.locator('#undo').tap();assert.equal((await snap()).moves,0);assert.equal((await snap()).ball,null);
  await page.evaluate(()=>localStorage.setItem('childgame.extra.slingblocks.v1',JSON.stringify({state:{bad:true},bests:{0:9999},history:[null]})));await page.reload();assert.equal((await snap()).phase,'playing');assert(await page.evaluate(()=>ExtraGame.paused()));assert.equal(await page.locator('#best').textContent(),'本关记录 ☆☆☆ · 10 个关卡');
 }finally{await h.close();}
});
test('Extra shell: independent held pointers and keyboard switches release exactly once',{timeout:30000},async()=>{
 const h=await setup(),{page,install,snap}=h;
 try{
  await install(game('fireice').create(0,37));await page.locator('#resume').tap();await page.locator('#board').focus();await page.keyboard.press('x');assert.equal((await snap()).active,1);
  await page.evaluate(()=>{for(const [a,id]of [['right',21],['jump',22]]){const b=document.querySelector(`[data-action="${a}"]`),r=b.getBoundingClientRect();b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:id===21,button:0,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));}});await page.waitForTimeout(150);const moving=await snap();assert(moving.chars[1].x>90);assert(moving.chars[1].y<650);
  await page.locator('#help').tap();const help=await snap();assert(Object.values(help.keys).every(v=>!v));await page.locator('#confirm').tap();await page.waitForTimeout(80);assert(Object.values((await snap()).keys).every(v=>!v));
  await page.locator('#board').focus();await page.keyboard.down('ArrowRight');await page.locator('#hint').tap();await page.keyboard.up('ArrowRight');assert.equal((await snap()).keys.right,false,'keyup releases after focus moves to a toolbar button');
  await page.locator('#board').focus();await page.keyboard.down('ArrowRight');await page.waitForTimeout(100);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('ArrowRight');assert(await page.evaluate(()=>ExtraGame.paused()));assert(Object.values((await snap()).keys).every(v=>!v));
 }finally{await h.close();}
});
