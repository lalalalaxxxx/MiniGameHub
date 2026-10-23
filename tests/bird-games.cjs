'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright'),C=require('../assets/js/bird-core.js'),KEY='childgame.birdblast.v2';
async function setup(){
 const root=path.resolve(__dirname,'..'),types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.wav':'audio/wav','.json':'application/json','.svg':'image/svg+xml'};
 const server=http.createServer((req,res)=>{let f=new URL(req.url,'http://local').pathname.replace(/^\/minigames\//,'/');if(f.endsWith('/'))f+='index.html';fs.readFile(path.join(root,f),(e,b)=>{res.writeHead(e?404:200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(e?'':b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium,browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 const page=await browser.newPage({viewport:{width:1024,height:650},hasTouch:true,serviceWorkers:'block'}),base=`http://127.0.0.1:${server.address().port}/minigames/`,errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
 const snap=()=>page.evaluate(()=>BirdGame.snapshot()),cell=i=>page.locator(`[data-cell="${i}"]`);
 async function install(s){assert.deepEqual(C.restore(s),s);await page.goto(base+'index.html');await page.evaluate(([key,s])=>localStorage.setItem(key,JSON.stringify(s)),[KEY,s]);await page.goto(base+'games/birdblast/index.html');await page.waitForFunction(()=>window.BirdGame);assert.deepEqual(await snap(),s);}
 async function drag(a,b){const from=await cell(a).boundingBox(),to=await cell(b).boundingBox();await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:5});await page.mouse.up();}
 async function close(){await browser.close();await new Promise(r=>server.close(r));assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);}
 return{page,base,engine,browser,snap,cell,install,drag,close};
}
function fixture(mode='practice'){
 const s=C.fresh(mode,37);s.board.fill(null);s.charges=[];s.supplyLeft=100;
 const put=(i,color=0,special='',extra={})=>s.board[i]={uid:s.nextId++,kind:'bird',color,special,lock:0,hp:0,loot:'',...extra};return{s,put};
}
test('Bird UI: side grabs, live append window, secondary touch, cancelled drag, real effects and persistence',{timeout:90000},async()=>{
 const h=await setup(),{page,snap,install,drag,cell}=h;try{
  const f=fixture();f.put(63,1);const bird=f.put(56,0);f.put(49,2);f.put(69,3);await install(f.s);await page.locator('#resume').tap();await drag(56,4);assert.equal((await snap()).board[67].uid,bird.uid);assert.equal((await snap()).moves,1);
  const a=fixture();a.put(63);a.put(64);a.put(66);a.put(67);a.put(69,2);await install(a.s);await page.locator('#resume').tap();
  await page.evaluate(()=>{
   const el=i=>document.querySelector(`[data-cell="${i}"]`);
   const point=i=>{const r=el(i).getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2];};
   const pointer=(type,id,i,x,y,primary=true)=>el(i).dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:primary,button:0,clientX:x,clientY:y}));
   let p=point(66),q=point(65);pointer('pointerdown',11,66,...p);pointer('pointerdown',12,69,...point(69),false);pointer('pointerup',12,69,...point(69),false);pointer('pointermove',11,66,...q);pointer('pointerup',11,66,...q);
   p=point(67);q=point(66);pointer('pointerdown',13,67,...p);pointer('pointermove',13,67,...q);pointer('pointerup',13,67,...q);
   p=point(69);q=point(68);pointer('pointerdown',14,69,...p);pointer('pointermove',14,69,...q);pointer('pointercancel',14,69,...q);
  });
  const pending=await snap();assert.equal(pending.moves,2);assert.equal(pending.charges[0].uids.length,4);assert(pending.board[69]);
  await page.locator('#pause').tap();const frozen=await snap();await page.reload();assert.deepEqual(await snap(),frozen,'reload retains pending match and the remaining append window');assert(await page.evaluate(()=>BirdGame.paused()));await page.locator('#resume').tap();
  await page.waitForFunction(()=>BirdGame.snapshot().score>0);assert((await snap()).board.some(b=>b?.special==='glow'));
  await page.waitForFunction(()=>!BirdGame.busy());assert.equal((await snap()).moves,2);
  const memory=await page.evaluate(()=>({buttons:document.querySelectorAll('#cells button').length,fx:BirdGame.effects()}));assert.equal(memory.buttons,70);assert(memory.fx.particles<=180&&memory.fx.beams<=16);
  await page.locator('#hint').tap();assert(await page.locator('.hinted').count()>0);
  await page.locator('#help').tap();const help=await snap();await page.waitForTimeout(200);assert.deepEqual(await snap(),help);await page.locator('#confirm').tap();
  await page.locator('#restart').tap();await page.locator('#cancel').tap();assert.equal((await snap()).moves,2);
 }finally{await h.close();}
});
test('Bird UI: ice top release and next wave, all modes, timed results, sound and viewport controls',{timeout:120000},async()=>{
 const h=await setup(),{page,snap,install,cell}=h;try{
  const ice=fixture('ice');ice.put(42);ice.put(49);ice.put(56,1);ice.put(43,-1,'',{kind:'ice',hp:1,loot:'clock'});ice.put(57,-1,'',{kind:'ice',hp:1,loot:'egg'});ice.s.next[0].color=0;ice.s.supplyLeft=0;
  await install(ice.s);await page.locator('#resume').tap();await cell(35).tap();await page.waitForFunction(()=>BirdGame.snapshot().wave===2);assert((await snap()).timeLeft>75);assert.equal((await snap()).moves,1);assert.equal(await page.locator('#cells button').count(),63);
  for(const mode of ['classic','pandora','practice','fever','ice']){
   const s=C.fresh(mode,741);await install(s);await page.locator('#resume').tap();await page.locator('#pause').tap();const stop=await snap();await page.waitForTimeout(180);assert.deepEqual(await snap(),stop);
   await page.locator('#mode').selectOption(mode==='classic'?'practice':'classic');await page.locator('#cancel').tap();assert.equal((await snap()).mode,mode);
   await page.locator('#mode').selectOption(mode==='classic'?'practice':'classic');await page.locator('#confirm').tap();assert.equal((await snap()).mode,mode==='classic'?'practice':'classic');
  }
  for(const mode of ['pandora','fever','ice']){const s=C.fresh(mode,37);s.timeLeft=.3;await install(s);await page.locator('#resume').tap();await page.waitForFunction(()=>BirdGame.snapshot().phase!=='playing');assert(await page.locator('#overlay').isVisible());await page.locator('#resume').tap();assert.equal((await snap()).phase,'playing');}
  await page.locator('#pause').tap();await page.locator('#sound').tap();const hasAudio=await page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext));if(hasAudio){await page.waitForFunction(()=>['on','off'].includes(document.querySelector('#sound').dataset.audioState));await page.locator('#sound').tap();await page.waitForFunction(()=>document.querySelector('#sound').dataset.audioState==='on');}
  for(const size of [{width:1024,height:650},{width:1180,height:820},{width:820,height:1180},{width:390,height:844},{width:768,height:500}]){
   await page.setViewportSize(size);await page.waitForTimeout(100);const metrics=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,buttons:['pause','hint','shuffle','restart','help','sound'].map(id=>document.getElementById(id).getBoundingClientRect().toJSON()),board:document.querySelector('#board').getBoundingClientRect().toJSON()}));
   assert(metrics.sw<=metrics.w+1&&metrics.sh<=metrics.h+1,JSON.stringify(metrics));for(const r of metrics.buttons)assert(r.x>=0&&r.y>=0&&r.right<=metrics.w+1&&r.bottom<=metrics.h+1,'controls fit the screen');assert(metrics.board.width>170&&metrics.board.height>250);
  }
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});const hidden=await snap();await page.waitForTimeout(200);assert.deepEqual(await snap(),hidden);assert(await page.evaluate(()=>BirdGame.paused()));
 }finally{await h.close();}
});
test('Bird UI: all powers animate with bounded work; play remains available during the burst',{timeout:90000},async()=>{
 const h=await setup(),{page,snap,install}=h;try{
  if(h.engine===chromium){const session=await page.context().newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:4});}
  for(const special of ['glow','fire','lightning','whirlwind']){
   const f=fixture();f.put(63,0,special);f.put(64);f.put(66);if(special!=='whirlwind')f.put(34,2);await install(f.s);await page.locator('#resume').tap();
   await page.evaluate(()=>{window.frameTimes=[];window.oldCells=[...document.querySelectorAll('#cells button')];let last=performance.now();window.collectFrames=true;function sample(t){if(!collectFrames)return;frameTimes.push(t-last);last=t;requestAnimationFrame(sample);}requestAnimationFrame(sample);});
   await h.drag(66,2);await page.waitForFunction(()=>BirdGame.effects().beams>0);const fx=await page.evaluate(()=>BirdGame.effects());assert(fx.beams<=16&&fx.rings<=16&&fx.particles<=180&&fx.ghosts<=80);
   assert(await page.evaluate(()=>[...document.querySelectorAll('#cells button')].every(el=>!el.disabled)),'effects never disable the board');
   await page.waitForFunction(()=>Object.entries(BirdGame.effects()).filter(([k])=>k!=='sprites').every(([,n])=>n===0));
   const frames=await page.evaluate(()=>{collectFrames=false;return frameTimes.sort((a,b)=>a-b);});assert(frames.length>10);const p95=frames[Math.floor(frames.length*.95)];console.log(`${special}: ${frames.length} frames, p95 ${p95.toFixed(1)}ms`);assert(p95<120,'bounded rendering remains responsive under 4x CPU throttling');
   assert(await page.evaluate(()=>oldCells.every((el,i)=>el===document.querySelectorAll('#cells button')[i])));assert((await snap()).score>0);
  }
 }finally{await h.close();}
});
