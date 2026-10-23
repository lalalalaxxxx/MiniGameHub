const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright'),C=require('../assets/js/defense-core.js'),B=require('./defense-strategy.cjs'),plans=require('./defense-hard.json');
test('Challenge balance: passive play fails, mixed strategy wins, both expert campaigns are achievable',()=>{
 for(const id of ['gardenwatch','toydefense']){
  assert.equal(C.fresh(id).difficulty,'normal');assert.equal(B.simulate(id,'normal','idle').state.phase,'lost');assert.equal(B.simulate(id,'normal','basic').state.phase,'lost');
  const mixed=B.simulate(id,'normal','mixed').state;assert.equal(mixed.phase,'won');assert.equal(mixed.wave,10);
  for(const dt of [.1,1/60]){
   const s=C.fresh(id,'hard'),seen=new Set();let ticks=0;
   for(const round of plans[id]){
    for(const [op,cell,type]of round)assert(op==='b'?C.build(s,cell,type):C.upgrade(s,cell),'strategy must afford every action');assert(C.start(s));
    while(s.phase==='running'&&ticks++<150000){C.tick(s,dt);for(const e of s.enemies)seen.add(e.kind);if(ticks%100===0)assert.deepEqual(C.restore(id,s),s);}
   }
   assert.equal(s.phase,'won');assert.equal(s.wave,12);for(const kind of ['runner','armor','swarm','boss'])assert(seen.has(kind));
   const won=C.clone(s);for(let i=0;i<200;i++)C.tick(s,.1);assert.deepEqual(s,won);
  }
 }
});
test('Armor mitigation, splash counter, boss penalty and legacy saves',()=>{
 for(const type of [0,1]){
  const s=C.fresh('gardenwatch');s.wave=3;s.phase='running';s.spawned=C.count(s);s.enemies=[{id:1,kind:'armor',p:2,lane:0,hp:100,max:100,slow:0}];s.nextId=2;
  s.projectiles=[{x:6.5,y:.5,tx:6.5,ty:.5,type,damage:20,life:3,target:1}];C.tick(s,.01);assert.equal(s.enemies[0].hp,type===1?72:91);
 }
 const s=C.fresh('gardenwatch');s.wave=5;s.phase='running';s.spawned=C.count(s);s.enemies=[{id:1,kind:'boss',p:8.49,lane:0,hp:100,max:100,slow:0}];s.nextId=2;C.tick(s,.1);assert.equal(s.hearts,5);const coins=s.coins;C.tick(s,.1);assert.equal(s.coins,coins);
 const old=C.fresh('toydefense');delete old.rules;old.wave=4;old.phase='running';old.hearts=12;assert.deepEqual(C.restore(old.id,old),old);assert.equal(C.waves(old),6);
 const corrupt={...s,enemies:[{...s.enemies[0],kind:'invalid'}]};assert.deepEqual(C.restore(s.id,corrupt),C.fresh(s.id));
});
test('Challenge browser: default mode, wave forecasts, enemy identities, paused saves and expert selection',{timeout:60000},async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const f=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav','.json':'application/json'})[path.extname(f)]||'application/octet-stream'});res.end(e?'':b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium,browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:650},serviceWorkers:'block'}),base=`http://127.0.0.1:${server.address().port}/`,errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const id of ['gardenwatch','toydefense']){
   await page.goto(base+`games/${id}/index.html`);assert.equal(await page.locator('#difficulty').inputValue(),'normal');assert.match(await page.locator('#wave').textContent(),/10/);
   await page.locator('#difficulty').selectOption('hard');await page.locator('#confirm').click();assert.match(await page.locator('#wave').textContent(),/12/);
   const s=C.fresh(id,'hard');for(let wave=0;wave<12;wave++){
    for(const [op,cell,type]of plans[id][wave])assert(op==='b'?C.build(s,cell,type):C.upgrade(s,cell));C.start(s);
    while(s.phase==='running'&&(wave<11||!s.enemies.some(e=>e.kind==='boss')))C.tick(s,.1);
   }
   await page.goto(base+'index.html');await page.evaluate(([id,s])=>localStorage.setItem(`childgame.defense.${id}.v1`,JSON.stringify(s)),[id,s]);await page.goto(base+`games/${id}/index.html`);
   assert(await page.evaluate(()=>DefenseGame.paused()));assert.deepEqual(await page.evaluate(()=>DefenseGame.snapshot()),s);assert.equal(await page.locator('.enemy-boss').count(),1);assert.match(await page.locator('#wave-note').textContent(),/首领/);
   await page.locator('#pause').click();await page.waitForTimeout(1100);await page.locator('#pause').click();const paused=await page.evaluate(()=>DefenseGame.snapshot());await page.reload();assert.deepEqual(await page.evaluate(()=>DefenseGame.snapshot()),paused);
   await page.screenshot({path:path.join(require('os').tmpdir(),`challenge-${id}.png`)});
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
