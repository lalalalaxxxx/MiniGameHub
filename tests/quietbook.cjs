const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
test('quiet book touch play, saving, cancellation and layouts',{timeout:90000},async()=>{
  const root=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{let file=new URL(req.url,'http://localhost').pathname;const target=path.join(root,file);fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/games/quietbook/index.html`);
    const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('childgame.quietbook.v1')));
    const pos=(x,y)=>page.evaluate(({x,y})=>{const p=new DOMPoint(x,y).matrixTransform(document.querySelector('#scene').getScreenCTM());return {x:p.x,y:p.y};},{x,y});
    const tap=async(x,y)=>{const p=await pos(x,y);await page.touchscreen.tap(p.x,p.y);};
    await page.locator('[data-item="ice-dress"]').tap();await tap(550,360);
    assert.equal((await saved()).looks['garden:0'].slots.top,'ice-dress');
    await page.locator('[data-theme="snow"]').tap();await page.locator('[data-actor="1"]').tap();
    await page.locator('[data-preset="picnic"]').tap();
    await page.locator('[data-item="apple"]').tap();await tap(530,420);
    let state=await saved(),apple=state.rooms.dining.at(-1);assert.equal(apple.x,530);assert.equal(apple.y,408);
    // Move a placed food to the mouth; one bite is consumed, original position stays.
    let from=await pos(apple.x,apple.y),to=await pos(266,281.5);
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();
    assert.equal((await saved()).rooms.dining.at(-1).bites,2);
    await page.locator('[data-preset="night"]').tap();
    await page.locator('[data-item="bunny"]').tap();await tap(390,530);
    const before=await saved();
    // Real two-finger events in Chromium: secondary touch cannot move/release first drag.
    if(engine===chromium){
      const cdp=await context.newCDPSession(page);from=await pos(390,530);to=await pos(440,510);
      const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
      await touch('touchStart',[{id:1,...from}]);await touch('touchMove',[{id:1,...to}]);
      await touch('touchStart',[{id:1,...to},{id:2,x:100,y:100}]);
      await touch('touchMove',[{id:1,...to},{id:2,x:200,y:100}]);
      assert.deepEqual(await saved(),before);
      await touch('touchEnd',[{id:1,...to}]);await touch('touchEnd',[]);
      assert(Math.abs((await saved()).rooms.home.at(-1).x-440)<2);
      await page.locator('#undo').click();
      assert.deepEqual(await saved(),before,'undo restores pre-drag position');
      await touch('touchStart',[{id:1,...from}]);await touch('touchMove',[{id:1,...to}]);await touch('touchCancel',[]);
      assert.deepEqual(await saved(),before);
    }
    from=await pos(390,530);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(5,5);await page.mouse.up();assert.deepEqual(await saved(),before);
    await page.locator('#clear').tap();await page.locator('#cancel-clear').tap();assert.deepEqual(await saved(),before);
    await page.locator('#clear').tap();await page.locator('#confirm-clear').tap();assert.equal((await saved()).rooms.home.length,0);
    await page.locator('#undo').click();assert.deepEqual(await saved(),before);
    await page.reload();assert.deepEqual(await saved(),before);
    await tap(390,530);await page.locator('#remove').tap();assert.equal((await saved()).rooms.home.length,before.rooms.home.length-1);
    for(const viewport of [{width:820,height:1180},{width:1180,height:820},{width:390,height:844}]){
      await page.setViewportSize(viewport);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert(await page.locator('#scene').isVisible());
      const box=await page.locator('#tray').boundingBox();assert(box.height>60);
      if(viewport.width===1180)await page.screenshot({path:path.join(root,'quietbook-preview.png')});
    }
    await page.evaluate(()=>localStorage.setItem('childgame.quietbook.v1','{"version":1,"theme":"__proto__","rooms":{"home":[null,{"id":"bogus"}]}}'));
    await page.reload();await page.locator('[data-preset="day"]').tap();assert.equal((await saved()).theme,'garden');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});

