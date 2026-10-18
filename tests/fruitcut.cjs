const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../games/fruitcut/engine.js'),fs=require('fs'),path=require('path'),http=require('http'),os=require('os');
const {chromium,webkit}=require('playwright');
const fruit=(id,x,kind='melon')=>({id,x,y:300,r:40,entered:true,kind,vx:0,vy:0,angle:0,spin:0});
test('Fruit cutting: swept collision, scoring, bombs, spawning, expiry and paused physics',()=>{
  const s=E.create();s.status='playing';s.fruits=[fruit(1,200),fruit(2,400),fruit(3,600)];const stroke={combo:0,lastAt:-Infinity};
  assert.deepEqual(E.slash(s,{x:200,y:300},{x:201,y:300},stroke),[]);
  assert.equal(E.slash(s,{x:100,y:300},{x:700,y:300},stroke).length,3);assert.equal(s.score,40);assert.equal(s.bestCombo,3);assert.equal(s.fruits.length,0);
  E.slash(s,{x:100,y:300},{x:700,y:300},stroke);assert.equal(s.score,40);
  s.elapsed=1;s.fruits=[fruit(4,300)];E.slash(s,{x:200,y:300},{x:400,y:300},stroke);assert.equal(s.score,50);assert.equal(stroke.combo,1);
  s.status='paused';const before=JSON.stringify(s);E.step(s,.05);E.slash(s,{x:0,y:0},{x:900,y:650},stroke);assert.equal(JSON.stringify(s),before);
  const challenge=E.create('challenge');challenge.status='playing';challenge.score=35;
  for(let i=0;i<3;i++){challenge.fruits=[fruit(i,400,'bomb')];E.slash(challenge,{x:300,y:300},{x:500,y:300},{combo:0});}
  assert.equal(challenge.score,0);assert.equal(challenge.bombs,3);assert.equal(challenge.status,'over');
  const miss=E.create();miss.status='playing';miss.spawn=100;miss.fruits=[{...fruit(1,200),y:800}];E.step(miss,.05);assert.equal(miss.score,0);assert.equal(miss.fruits.length,0);
  for(const mode of ['relax','challenge']){const game=E.create(mode);game.status='playing';let visible=false,bombs=0;for(let i=0;i<1300;i++){E.step(game,.05,()=>.1);visible||=game.fruits.some(f=>f.entered&&f.y<500);bombs+=game.fruits.filter(f=>f.kind==='bomb').length;assert(game.fruits.length<20);}assert(visible);assert.equal(game.status,'over');assert.equal(game.time,0);assert.equal(mode==='relax'?bombs:0,0);if(mode==='challenge')assert(bombs>0);}
  assert(!E.intersects({x:0,y:0},{x:100,y:0},fruit(1,200)));
});
test('Fruit cut browser: swipe scoring, multitouch isolation, pause, records, restart and layouts',{timeout:120000},async()=>{
  const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.wav':'audio/wav'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const url=`http://127.0.0.1:${server.address().port}/games/fruitcut/index.html`;await page.goto(url);await page.locator('#play').tap();
    const snap=()=>page.evaluate(()=>FruitCut.snapshot());
    await page.waitForFunction(()=>FruitCut.snapshot().fruits.some(f=>f.y<440));
    const cut=async()=>{const s=await snap(),f=s.fruits.find(f=>f.y>100&&f.y<480&&f.kind!=='bomb');if(!f)return false;const box=await page.locator('#game').boundingBox(),v=s.view;const x=box.x+v.x+f.x*v.scale,y=box.y+v.y+f.y*v.scale;await page.mouse.move(x-65*v.scale,y);await page.mouse.down();await page.mouse.move(x+65*v.scale,y,{steps:2});await page.mouse.up();return true;};
    for(let i=0;i<8&&(await snap()).score===0;i++){await cut();await page.waitForTimeout(100);}assert((await snap()).score>0);
    await page.locator('#pause').tap();let s=await snap();assert.equal(s.status,'paused');await page.waitForTimeout(200);assert.equal((await snap()).time,s.time);
    await page.locator('#play').tap();assert.equal((await snap()).status,'playing');
    const old=(await snap()).score;await page.locator('#restart').tap();assert(await page.locator('#confirm-dialog').evaluate(el=>el.open));await page.locator('#cancel').tap();assert.equal((await snap()).score,old);
    await page.locator('#restart').tap();await page.locator('#confirm').tap();assert.equal((await snap()).score,0);assert(Number(await page.locator('#best').textContent())>0);
    if(engine===chromium){
      await page.waitForFunction(()=>FruitCut.snapshot().fruits.some(f=>f.y<400));
      const cdp=await context.newCDPSession(page),box=await page.locator('#game').boundingBox();s=await snap();const v=s.view;
      const row=s.fruits.find(f=>f.y<400).y;
      const p1={id:1,x:box.x+v.x+30*v.scale,y:box.y+v.y+row*v.scale},p2={id:2,x:box.x+v.x+870*v.scale,y:box.y+v.y+row*v.scale};
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1,p2]});assert.equal((await snap()).pointers,2);assert.equal((await snap()).score,0);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p1,y:p1.y-5},p2]});assert.equal((await snap()).score,0);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal((await snap()).pointers,0);await cdp.detach();
    }
    await page.locator('[data-mode="challenge"]').tap();await page.locator('#confirm').tap();assert.equal((await snap()).mode,'challenge');assert.equal(await page.locator('#best').textContent(),'0');
    await page.waitForFunction(()=>FruitCut.snapshot().fruits.some(f=>f.y<400));await page.locator('#pause').tap();
    for(const viewport of [{width:820,height:1180},{width:390,height:844},{width:1180,height:820}]){await page.setViewportSize(viewport);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert((await page.locator('#restart').boundingBox()).height>=44);assert((await page.locator('#game').boundingBox()).height>=360);}
    await page.locator('#play').tap();await page.waitForTimeout(200);await page.screenshot({path:path.join(os.tmpdir(),'fruitcut-preview.png'),fullPage:true});
    await page.locator('#sound').tap();assert.equal(await page.locator('#sound').getAttribute('data-audio-state'),'off');await page.locator('#sound').tap();
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await snap()).status,'paused');
    await page.locator('#restart').tap();await page.locator('#cancel').tap();assert.equal((await snap()).status,'paused');
    await page.reload();assert.equal((await snap()).status,'ready');assert(Number(await page.locator('#best').textContent())>0);
    await page.addInitScript(()=>localStorage.setItem('childgame.fruitcut.best.v1','{"relax":"broken","challenge":-1}'));await page.reload();assert.equal(await page.locator('#best').textContent(),'0');
    await page.clock.install();await page.locator('#play').tap();await page.clock.runFor(61000);assert.equal((await snap()).status,'over');assert.equal(await page.locator('#time').textContent(),'0');assert(await page.locator('#overlay').isVisible());await page.locator('#play').tap();assert.equal((await snap()).status,'playing');assert.equal((await snap()).score,0);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});
