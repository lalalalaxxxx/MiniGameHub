const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
test('Game feedback follows actions, respects reduced motion, cleans up and keeps saves independent',{timeout:60000},async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav'})[path.extname(file)]||'application/octet-stream'});res.end(err?'':data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
 const browser=await engine.launch(engine===webkit?{headless:true}:{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:650},serviceWorkers:'block'}),base=`http://127.0.0.1:${server.address().port}/`,errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'games/toyblast/index.html');const saved=await page.evaluate(()=>CozyGame.snapshot());
  const index=await page.evaluate(()=>CozyGame.snapshot().board.findIndex((_,i)=>CozyCore.group(CozyGame.snapshot().board,i).length>1));
  await page.locator(`[data-action=tile][data-value="${index}"]`).click();assert(await page.locator('[data-fx-event=drop]').count()>0);
  const moved=await page.evaluate(()=>CozyGame.snapshot());assert.notDeepEqual(moved,saved);
  await page.waitForTimeout(800);assert.equal(await page.locator('#game-fx-layer > *').count(),0);assert.deepEqual(await page.evaluate(()=>CozyGame.snapshot()),moved);
  await page.locator('#undo').click();assert.deepEqual(await page.evaluate(()=>CozyGame.snapshot()),saved);
  await page.goto(base+'games/memory/index.html');await page.locator('[data-action=flip][data-value="0"]').click();assert.equal(await page.locator('[data-fx-event=flip]').count(),1);
  await page.waitForTimeout(400);assert.equal(await page.locator('#game-fx-layer > *').count(),0);
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-action=flip][data-value="1"]').click();assert.equal(await page.evaluate(()=>document.getAnimations().length),0);await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto(base+'games/pipes/index.html');const pipe=page.locator('[data-action=rotate]:not(:disabled)').first();await pipe.click();assert(await page.locator('[data-fx-event=pipe]').count()>0);for(let i=0;i<4&&!await page.locator('.water-flow').count();i++)await pipe.click();assert(await page.locator('.water-flow').count()>0);
  await page.goto(base+'games/icecream/index.html');await page.locator('[data-action=flavor][data-value="0"]').click();assert.equal(await page.locator('.scoop[data-fx-event=drop]').count(),1);
  await page.goto(base+'games/bearclock/index.html');await page.locator('[data-action=start]').click();await page.locator('[data-action=w-time][data-value="60"]').click();assert(await page.locator('[data-fx-event=clock]').count()>0);
  await page.waitForTimeout(400);assert(await page.evaluate(()=>{const clock=document.querySelector('.teaching-clock').getBoundingClientRect();return [...document.querySelectorAll('[data-clock-angle]')].every(el=>{const r=el.getBoundingClientRect();return r.left>=clock.left&&r.right<=clock.right&&r.top>=clock.top&&r.bottom<=clock.bottom;});}),'clock hands stay on the dial after rotating');
  // Decoration must not create unbounded nodes during rapid input.
  await page.evaluate(()=>{const el=document.querySelector('.clock-bear');for(let i=0;i<30;i++)GameFeedback.celebrate(el);});assert((await page.locator('#game-fx-layer > *').count())<=96);await page.waitForTimeout(800);assert.equal(await page.locator('#game-fx-layer > *').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
