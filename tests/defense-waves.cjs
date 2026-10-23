const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright'),C=require('../assets/js/defense-core.js');
test('Defense real-time countdown: both games, 2x speed, pause, reload and automatic launch',{timeout:60000},async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});res.end(err?'':data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
 const browser=await engine.launch(engine===webkit?{headless:true}:{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({serviceWorkers:'block'}),base=`http://127.0.0.1:${server.address().port}/`,errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const id of ['gardenwatch','toydefense']){
   await page.goto(base+"index.html");const s=C.fresh(id);s.wave=1;s.spawned=7;s.breakLeft=4;
   await page.evaluate(([key,s])=>localStorage.setItem(key,JSON.stringify(s)),[`childgame.defense.${id}.v1`,s]);await page.goto(base+`games/${id}/index.html`);
   const snap=()=>page.evaluate(()=>DefenseGame.snapshot());assert(await page.evaluate(()=>DefenseGame.paused()));
   await page.locator('#speed').click();await page.locator('#pause').click();await page.waitForTimeout(1000);
   const ticking=await snap();assert(ticking.breakLeft>2.6&&ticking.breakLeft<3.5,'2x must not halve building time');
   await page.locator('#pause').click();const frozen=await snap();await page.waitForTimeout(500);assert.deepEqual(await snap(),frozen);
   await page.reload();assert.deepEqual(await snap(),frozen);assert(await page.evaluate(()=>DefenseGame.paused()));
   await page.locator('#pause').click();await page.waitForFunction(()=>DefenseGame.snapshot().wave===2,null,{timeout:7000});
   assert.equal((await snap()).phase,'running');assert(await page.locator('#start').isDisabled());
   await page.locator('#restart').click();await page.locator('#confirm').click();assert.equal((await snap()).wave,0);
   console.log('PASS real-time automatic waves '+id);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
