'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium,webkit}=require('playwright');
const {C,brickAim}=require('./helpers/casual');
function minerTarget(s){
 const firstHit=angle=>s.items.map(item=>{
  const x=item.x-360,y=item.y-145,along=x*Math.sin(angle)+y*Math.cos(angle),across=x*Math.cos(angle)-y*Math.sin(angle),radius=item.r+12;
  return{item,d:along>0&&Math.abs(across)<radius?along-Math.sqrt(radius*radius-across*across):Infinity};
 }).sort((a,b)=>a.d-b.d)[0];
 // Aim at the center of an unobstructed valuable item, never at a fixed ray.
 for(const item of s.items.filter(item=>item.kind!=='stone').sort((a,b)=>b.value/b.weight-a.value/a.weight)){
  const angle=Math.atan2(item.x-360,item.y-145);
  if(Math.abs(angle)<=1.02&&firstHit(angle)?.item.uid===item.uid)return{item,angle};
 }
 return null;
}
async function completeMiner(h){
 const {page,snap,tap}=h,shots=[];
 async function advanceUntil(predicate,limit,label,step=32){
  for(let elapsed=0;elapsed<=limit;elapsed+=step){const s=await snap();if(predicate(s))return s;assert.equal(s.phase,'playing',label+' ended before the expected event: '+JSON.stringify({phase:s.phase,shots}));await page.clock.runFor(step);}
  assert.fail(label+' did not occur: '+JSON.stringify({state:await snap(),shots}));
 }
 try{
  for(let i=0;i<10&&(await snap()).phase==='playing';i++){
   // Returning to swing retains the old fired angle until the following tick.
   // Advancing real RAF/physics under the Playwright clock removes that sample race.
   await page.clock.runFor(32);
   const current=await snap(),target=minerTarget(current);assert(target,'a valuable unobstructed target remains');
   const aimed=await advanceUntil(s=>s.hook.mode==='swing'&&Math.abs(s.hook.angle-target.angle)<.02,8000,'aim at item '+target.item.uid);
   await tap({x:360,y:300}); // Trusted touchscreen input; no simulation state is injected.
   const fired=await snap();assert.equal(fired.moves,aimed.moves+1);assert.equal(fired.hook.mode,'out');
   assert.equal(fired.hook.angle,aimed.hook.angle,'the frozen cursor preserves the measured firing direction');
   const caught=await advanceUntil(s=>s.hook.mode==='back',4000,'capture item '+target.item.uid);
   assert.equal(caught.hook.item,target.item.uid,'the aimed item is actually captured');
   const retrieved=await advanceUntil(s=>s.phase==='won'||s.hook.mode==='swing',8000,'retrieve item '+target.item.uid,64);
   assert.equal(retrieved.earned,current.earned+target.item.value);
   shots.push({uid:target.item.uid,angle:fired.hook.angle,earned:retrieved.earned});
  }
  const end=await snap();assert.equal(end.phase,'won','geometric miner strategy completes the real level: '+JSON.stringify(shots));assert(end.earned>=end.target);
  console.log('PASS miner aimed touch captures '+JSON.stringify(shots));
 }finally{await page.clock.resume();}
}
async function setup(){
 const root=path.resolve(__dirname,'..'),types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.wav':'audio/wav','.json':'application/json','.svg':'image/svg+xml'};
 const server=http.createServer((req,res)=>{let f=new URL(req.url,'http://local').pathname.replace(/^\/minigames\//,'/');if(f.endsWith('/'))f+='index.html';fs.readFile(path.join(root,f),(e,b)=>{res.writeHead(e?404:200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(e?'':b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium,browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 const page=await browser.newPage({viewport:{width:1024,height:650},hasTouch:true,serviceWorkers:'block'}),base=`http://127.0.0.1:${server.address().port}/minigames/`,errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
 const snap=()=>page.evaluate(()=>CasualGame.snapshot());
 async function install(s){assert.deepEqual(C.restore(s.id,s),s);await page.goto(base+'index.html');await page.evaluate(s=>localStorage.setItem(`childgame.casual.${s.id}.v1`,JSON.stringify({state:s})),s);await page.goto(base+`games/${s.id}/index.html`);await page.waitForFunction(()=>window.CasualGame);assert.deepEqual(await snap(),s);}
 async function point(p){const r=await page.locator('#board').boundingBox();return{x:r.x+p.x/720*r.width,y:r.y+p.y/800*r.height};}
 async function tap(p){const a=await point(p);await page.touchscreen.tap(a.x,a.y);}
 async function drag(a,b){a=await point(a);b=await point(b);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});await page.mouse.up();}
 async function capture(name){const dir=path.join(os.tmpdir(),'childgame-casual');fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,name+'.png')});}
 async function result(phase='won',timeout=20000){await page.waitForFunction(phase=>CasualGame.snapshot().phase===phase,phase,{timeout});await page.locator('#overlay').waitFor({state:'visible',timeout:5000});await page.waitForFunction(()=>!CasualGame.effects().raf,{},{timeout:5000});const fx=await page.evaluate(()=>CasualGame.effects());for(const key of ['particles','ghosts','rings','labels','ropeBits','impacts'])assert.equal(fx[key],0,phase+' final '+key);}
 async function close(){await browser.close();await new Promise(r=>server.close(r));assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);}
 return{page,base,browser,engine,snap,install,tap,drag,result,capture,close};
}
test('Casual UI: all controls fit tablet landscape, portrait and phone; start/pause/help/level/restart/audio work',{timeout:120000},async()=>{
 const h=await setup(),{page,install,snap}=h;
 try{for(const id of Object.keys(C.META)){
  await install(C.fresh(id,9,37));
  for(const size of [{width:1024,height:650},{width:820,height:560},{width:768,height:500},{width:768,height:1024},{width:390,height:844}]){
   await page.setViewportSize(size);await page.waitForTimeout(70);
   const report=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,board:document.querySelector('#board').getBoundingClientRect().toJSON(),bad:[...document.querySelectorAll('button,a,select')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).filter(e=>{const r=e.getBoundingClientRect(),side=e.closest('.side')?.getBoundingClientRect();return r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1||(side&&r.bottom>side.bottom-2);}).map(e=>e.id||e.textContent)}));
   assert(report.sw<=report.w+1&&report.sh<=report.h+1,JSON.stringify(report));assert.deepEqual(report.bad,[],id+' '+size.width+'x'+size.height);assert(report.board.width>240,id+' playable board');
  }
  await page.setViewportSize({width:1024,height:650});await page.locator('#resume').tap();await page.waitForTimeout(150);assert(!(await page.evaluate(()=>CasualGame.paused())));
  await page.locator('#pause').tap();const frozen=await snap();await page.waitForTimeout(150);assert.deepEqual(await snap(),frozen);await page.reload();assert.deepEqual(await snap(),frozen);assert(await page.evaluate(()=>CasualGame.paused()));
  await page.locator('#resume').tap();await page.locator('#help').tap();const help=await snap();await page.waitForTimeout(100);assert.deepEqual(await snap(),help);await page.locator('#confirm').tap();
  await page.locator('#levels').selectOption('0');await page.locator('#cancel').tap();assert.equal((await snap()).level,9);await page.locator('#levels').selectOption('0');await page.locator('#confirm').tap();assert.equal((await snap()).level,0);
  await page.locator('#resume').tap();await page.locator('#restart').tap();await page.locator('#confirm').tap();assert.equal((await snap()).t,0);assert(await page.evaluate(()=>CasualGame.paused()));
  await page.locator('#resume').tap();if(await page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext))){await page.waitForFunction(()=>document.querySelector('#sound').dataset.audioState==='on');await page.locator('#sound').tap();assert.equal(await page.locator('#sound').getAttribute('data-audio-state'),'off');await page.locator('#sound').tap();await page.waitForFunction(()=>document.querySelector('#sound').dataset.audioState==='on');}
  const dir=path.join(os.tmpdir(),'childgame-casual');fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,id+'.png')});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});const hidden=await snap();await page.waitForTimeout(100);assert.deepEqual(await snap(),hidden);assert(!(await page.evaluate(()=>CasualGame.effects().raf)));
  console.log('PASS UI controls '+id);
 }
 }finally{await h.close();}
});
test('Casual UI: complete real opening levels with touch, show results and advance to next level',{timeout:120000},async()=>{
 const h=await setup(),{page,install,snap,tap,drag}=h;
 try{for(const id of Object.keys(C.META)){
  if(id==='goldminer'){await page.clock.install({time:new Date('2030-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'));}
  await install(C.fresh(id,0,37));await page.locator('#resume').tap({force:id==='goldminer'});
  if(id==='bubblepop'){for(let i=0;i<24&&(await snap()).phase==='playing';i++){await tap(C.hint(await snap()));await page.waitForFunction(()=>!CasualGame.snapshot().shot);}}
  else if(id==='brickball'){await page.locator('#secondary').tap();for(let i=0;i<12&&(await snap()).phase==='playing';i++){await tap(brickAim(await snap()));await page.waitForFunction(()=>!CasualGame.snapshot().volley,{},{timeout:16000});}}
  else if(id==='goldminer')await completeMiner(h);
  else if(id==='ropefeast')await drag({x:270,y:230},{x:460,y:230});
  else await tap({x:155,y:145});
  await h.result();assert((await snap()).score>0);await h.capture(id+'-result');
  await page.locator('#resume').tap();assert.equal((await snap()).level,1);assert.equal((await snap()).phase,'playing');await page.waitForTimeout(150);assert(!(await page.locator('#overlay').isVisible()),id+' next level stays playable');console.log('PASS UI completion '+id);
 }
 }finally{await h.close();}
});
test('Casual UI: primary touch ownership, cancelled swipe, atomic undo, midshot reload and bounded effects',{timeout:60000},async()=>{
 const h=await setup(),{page,install,snap}=h;
 try{
  await install(C.fresh('ropefeast',9,37));await page.locator('#resume').tap();
  async function gesture(cancel=false){await page.evaluate(cancel=>{const el=document.querySelector('#board'),r=el.getBoundingClientRect();function send(type,id,x,y,primary=true){el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:primary,button:0,clientX:r.x+x/720*r.width,clientY:r.y+y/800*r.height}));}send('pointerdown',11,50,240);send('pointerdown',12,350,200,false);send('pointerup',12,650,200,false);send('pointermove',11,680,240);send(cancel?'pointercancel':'pointerup',11,680,240);},cancel);}
  await gesture(true);assert.equal((await snap()).cuts,0);assert.equal((await page.evaluate(()=>CasualGame.effects())).ropeBits,0);await gesture();assert.equal((await snap()).cuts,3);assert.equal((await snap()).moves,1);assert((await page.evaluate(()=>CasualGame.effects())).ropeBits>0);
  await page.locator('#pause').tap();await page.waitForFunction(()=>!CasualGame.effects().raf);const cutState=await snap(),cutEffects=await page.evaluate(()=>CasualGame.effects());await page.waitForTimeout(250);assert.deepEqual(await snap(),cutState);assert.deepEqual(await page.evaluate(()=>CasualGame.effects()),cutEffects);await page.locator('#resume').tap();await page.waitForFunction(()=>CasualGame.effects().ropeBits===0);await page.locator('#undo').tap();assert.equal((await snap()).cuts,0);assert.equal((await page.evaluate(()=>CasualGame.effects())).ropeBits,0);
  await install(C.fresh('bubblepop',0,37));await page.locator('#resume').tap();await h.tap({x:80,y:610});await page.locator('#pause').tap();const shot=await snap();assert(shot.shot);await page.reload();assert.deepEqual(await snap(),shot);await page.locator('#resume').tap();await page.waitForFunction(()=>!CasualGame.snapshot().shot);await page.locator('#undo').tap();assert.equal((await snap()).shots,24);
  await page.locator('[data-mechanism="power"]').tap();assert.equal((await snap()).color,-1);await page.locator('#hint').tap();await page.locator('#primary').tap();await page.waitForFunction(()=>CasualGame.effects().ghosts>0);
  const fx=await page.evaluate(()=>CasualGame.effects());assert(fx.particles<=150&&fx.ghosts<=80&&fx.rings<=18&&fx.labels<=12&&fx.sprites<=10&&fx.ropeBits<=8&&fx.impacts<=77);
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#pause').tap();assert(await page.locator('#resume').isVisible());
 }finally{await h.close();}
});

test('Casual UI: win celebration settles, reduced motion omits fragments, loss/reload never strand results',{timeout:30000},async()=>{
 const h=await setup(),{page,install,snap}=h;
 try{
  async function observe(){await page.evaluate(()=>{window.casualOutcome={terminal:null,maxParticles:0,maxRopeBits:0};function watch(){const s=CasualGame.snapshot(),fx=CasualGame.effects();casualOutcome.maxParticles=Math.max(casualOutcome.maxParticles,fx.particles);casualOutcome.maxRopeBits=Math.max(casualOutcome.maxRopeBits,fx.ropeBits);if(s.phase!=='playing'){casualOutcome.terminal={phase:s.phase,hidden:document.querySelector('#overlay').hidden};return;}requestAnimationFrame(watch);}requestAnimationFrame(watch);});}
  for(const reducedMotion of ['no-preference','reduce']){
   await page.emulateMedia({reducedMotion});await install(C.fresh('ropefeast',0,37));await observe();await page.locator('#resume').tap();await h.drag({x:270,y:230},{x:460,y:230});if(reducedMotion==='no-preference'){await page.waitForFunction(()=>CasualGame.snapshot().phase==='won');await h.capture('ropefeast-celebration');}await h.result();
   const seen=await page.evaluate(()=>casualOutcome);assert.equal(seen.terminal.phase,'won');assert(seen.terminal.hidden,'completion gives the celebration a visible frame before results');
   if(reducedMotion==='reduce'){assert.equal(seen.maxParticles,0);assert.equal(seen.maxRopeBits,0);}else{assert(seen.maxParticles>0);assert(seen.maxRopeBits>0);}
   const won=await snap();await page.waitForTimeout(150);assert.deepEqual(await snap(),won);await page.reload();assert.deepEqual(await snap(),won);assert(await page.locator('#overlay').isVisible());await page.waitForFunction(()=>!CasualGame.effects().raf);await page.locator('#resume').tap();assert.equal((await snap()).level,1);assert(!(await page.locator('#overlay').isVisible()));
  }
  const lost=C.fresh('goldminer',0,37);lost.time=.06;await install(lost);await observe();await page.locator('#resume').tap();await h.result('lost',5000);assert.equal((await page.evaluate(()=>casualOutcome)).terminal.phase,'lost');await page.locator('#resume').tap();assert.equal((await snap()).phase,'playing');assert((await snap()).time>70);assert(!(await page.locator('#overlay').isVisible()));
 }finally{await h.close();}
});
test('Casual UI: large bursts and 30-ball volleys keep bounded effects and steady frames; corrupt metadata recovers',{timeout:45000},async()=>{
 const h=await setup(),{page,install}=h;
 try{
  if(h.engine===chromium){const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  for(const id of ['bubblepop','brickball']){
   const s=C.fresh(id,9,37);if(id==='bubblepop'){s.bubbles.forEach(b=>b.color=0);s.color=0;}else s.ballCount=30;
   await install(s);await page.locator('#resume').tap();await page.evaluate(()=>{window.samples=[];window.nodes=[...document.querySelectorAll('#mechanisms button')];window.sampling=true;let last=performance.now();function frame(t){if(!sampling)return;samples.push(t-last);last=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);});
   await h.tap({x:360,y:100});if(id==='bubblepop')await page.waitForFunction(()=>CasualGame.snapshot().phase==='won');await page.waitForTimeout(2500);
   const report=await page.evaluate(()=>{sampling=false;return{frames:samples.sort((a,b)=>a-b),effects:CasualGame.effects(),stable:nodes.every((el,i)=>el===document.querySelectorAll('#mechanisms button')[i])};});
   const p95=report.frames[Math.floor(report.frames.length*.95)];assert(report.frames.length>30);assert(p95<120,`${id}: p95 ${p95}ms`);assert(report.stable);assert(report.effects.particles<=150&&report.effects.ghosts<=80&&report.effects.rings<=18);console.log(`${id} ${h.engine===chromium?'4x CPU':'WebKit'}: p95 ${p95.toFixed(1)}ms`);
  }
  await page.evaluate(()=>localStorage.setItem('childgame.casual.brickball.v1',JSON.stringify({state:{bad:true},bests:{0:9999},history:[null]})));await page.reload();assert.equal((await h.snap()).phase,'playing');assert(await page.evaluate(()=>CasualGame.paused()));assert.equal(await page.locator('#best').textContent(),'本关记录 ☆☆☆ · 10 个关卡');
 }finally{await h.close();}
});
test('Casual UI: bubble/fan controls, elevator saves, alternating gates, miner tools and volley recall',{timeout:45000},async()=>{
 const h=await setup(),{page,install,snap}=h;
 try{
  await install(C.fresh('ropefeast',7,37));await page.locator('#resume').tap();await page.locator('[data-mechanism="rope0"]').tap();await page.waitForTimeout(250);assert((await snap()).candy.y<440);await page.locator('[data-mechanism="pop"]').tap();assert(!(await snap()).candy.bubble);await page.locator('[data-mechanism="fan"]').tap();assert((await snap()).fanOn);await page.locator('#undo').tap();assert(!(await snap()).fanOn);
  const lift=C.fresh('snailquest',3,37);lift.snail.x=360;lift.riding=true;await install(lift);await page.locator('#resume').tap();await page.locator('[data-mechanism="switch0"]').tap();await page.waitForFunction(()=>CasualGame.snapshot().snail.y<600);await h.capture('snailquest-lift');await page.locator('#pause').tap();const riding=await snap();await page.reload();assert.deepEqual(await snap(),riding);await page.locator('#resume').tap();await page.waitForFunction(()=>CasualGame.snapshot().liftY===430);assert((await snap()).snail.x>=360);
  const gates=C.fresh('snailquest',5,37);gates.snail.x=245;await install(gates);await page.locator('#resume').tap();await page.waitForFunction(()=>CasualGame.snapshot().snail.waiting);assert((await snap()).snail.x<280);await page.locator('[data-mechanism="switch0"]').tap();await page.waitForFunction(()=>{const s=CasualGame.snapshot();return s.snail.waiting&&s.snail.x>440;});await h.capture('snailquest-gates');await page.locator('[data-mechanism="switch0"]').tap();await page.waitForFunction(()=>CasualGame.snapshot().snail.x>500);
  const mine=C.fresh('goldminer',0,37);mine.hook={mode:'back',angle:0,length:350,item:mine.items.find(b=>b.kind==='stone').uid,fast:false};await install(mine);await page.locator('#resume').tap();await page.locator('#primary').tap();assert.equal((await snap()).boosts,1);await page.locator('#secondary').tap();assert.equal((await snap()).discards,1);assert.equal((await snap()).hook.item,null);assert.equal((await snap()).earned,0);
  await install(C.fresh('brickball',0,37));await page.locator('#resume').tap();await page.locator('#primary').tap();await page.locator('#secondary').tap();assert.equal((await snap()).speed,2);await page.locator('#primary').tap();assert.equal((await snap()).volley,null);assert.equal((await snap()).round,2);
 }finally{await h.close();}
});
