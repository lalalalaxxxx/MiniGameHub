const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
test('Aquarium: swimming, feeding, surface birds, pause, persistence and bounded food',{timeout:90000},async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});res.end(err?'':data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await (process.env.TEST_BROWSER==='webkit'?webkit:chromium).launch(process.env.TEST_BROWSER==='webkit'?{headless:true}:{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:650}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/games/aquarium/index.html`);
  const snap=()=>page.evaluate(()=>CozyGame.aquarium());
  for(const type of [5,6,7])await page.locator(`[data-action=add-fish][data-value="${type}"]`).click();
  assert.equal((await snap()).animals.length,5);
  const saved=await page.evaluate(()=>CozyGame.snapshot());
  await page.clock.install();
  await page.clock.runFor(1600);
  const moving=await snap();assert(moving.animals.some(a=>Math.hypot(a.vx,a.vy)>1));
  for(const a of moving.animals){if(Math.abs(a.vx)>1.2)assert.equal(a.face,Math.sign(a.vx));if(a.bird)assert(a.y>=15&&a.y<=19);}
  await page.locator('[data-action=feed]').click();
  const food=(await snap()).food;assert.equal(food.length,10);assert(new Set(food.map(f=>Math.round(f.y))).size>3);
  let sawBite=false,maxSpeed=0,minSpeed=100;
  for(let i=0;i<45;i++){await page.clock.runFor(200);const s=await snap();sawBite ||=s.animals.some(a=>a.bite>0);for(const a of s.animals){const speed=Math.hypot(a.vx,a.vy);maxSpeed=Math.max(speed,maxSpeed);if(a.bite>0)minSpeed=Math.min(speed,minSpeed);}}
  assert((await snap()).eaten>0);assert(sawBite);assert(maxSpeed>8);assert(minSpeed<maxSpeed);
  await page.locator('#help').click();const paused=await snap();await page.clock.runFor(1000);assert.deepEqual(await snap(),paused);await page.locator('#confirm').click();
  const before=await snap();await page.locator('[data-action=theme][data-value="1"]').click();const after=await snap();assert(Math.abs(before.animals[0].x-after.animals[0].x)<2);
  for(let i=0;i<9;i++){await page.clock.runFor(210);await page.locator('[data-action=feed]').click();}assert((await snap()).food.length<=60);
  await page.clock.runFor(26000);assert.equal((await snap()).food.length,0);
  assert.deepEqual((await page.evaluate(()=>CozyGame.snapshot())).fish,saved.fish);
  await page.reload();assert.equal((await snap()).animals.length,5);
  await page.screenshot({path:path.join(require('os').tmpdir(),'aquarium-preview.png'),fullPage:true});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
