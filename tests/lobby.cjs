const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium,webkit}=require('playwright');
test('Lobby: discovery, recent navigation, storage resilience and tablet layouts',{timeout:90000},async()=>{
  const root=path.resolve(__dirname,'..');
  const games=JSON.parse(fs.readFileSync(path.join(root,'games/manifest.json'),'utf8'));
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=path.join(root,pathname==='/'?'index.html':pathname);
    fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return;}
      res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try {
    const context=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const url=`http://127.0.0.1:${server.address().port}/`;
    await page.goto(url);await page.waitForSelector('.card');
    assert.equal(await page.locator('.card').count(),games.length);
    assert(await page.locator('#recent').isHidden());
    for(const [query,id] of [['飞机','shooter'],['换装','quietbook'],['七巧板','tangram'],['2048','2048'],['拼字','wordbuilder'],['平均分','fairshare'],['时间','bearclock']]) {
      await page.locator('#search').fill(query);assert.equal(await page.locator('.card').count(),1);
      assert.equal(await page.locator('.card').getAttribute('data-game'),id);
    }
    await page.locator('#reset').tap();
    for(const category of new Set(games.map(g=>g.category))) {
      await page.locator(`[data-category="${category}"]`).tap();
      assert.equal(await page.locator('.card').count(),games.filter(g=>g.category===category).length);
      assert.equal(await page.locator('[aria-pressed="true"]').count(),1);
    }
    await page.locator('#search').fill('no-such-game');assert(await page.locator('#empty').isVisible());
    await page.locator('#reset').tap();assert.equal(await page.locator('.card').count(),games.length);
    for(const id of ['sudoku','memory','sudoku']) {
      await page.locator(`.card[data-game="${id}"]`).tap();await page.waitForURL(`**/games/${id}/index.html`);
      await page.goBack();await page.waitForSelector('.card');
    }
    assert.deepEqual(await page.locator('.recent-game').evaluateAll(els=>els.map(el=>el.dataset.game)),['sudoku','memory']);
    await page.reload();await page.waitForSelector('.recent-game');
    for(const [width,height,columns] of [[1180,820,4],[820,1180,3],[390,844,2]]) {
      await page.setViewportSize({width,height});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.equal(await page.locator('#grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),columns);
      for(const box of await page.locator('.chip').evaluateAll(els=>els.map(el=>({width:el.offsetWidth,height:el.offsetHeight}))))assert(box.width>=44&&box.height>=44);
      await page.screenshot({path:path.join(os.tmpdir(),`lobby-${width}.png`),fullPage:true});
    }
    await page.locator('#search').fill('飞机');assert(await page.locator('#recent').isHidden());
    await page.locator('#reset').click();await page.keyboard.type('2048');assert.equal(await page.locator('.card').count(),1);
    await page.evaluate(()=>localStorage.setItem('childgame.lobby.recent.v1','broken'));await page.reload();await page.waitForSelector('.card');assert(await page.locator('#recent').isHidden());
    await context.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('disabled');};Storage.prototype.setItem=()=>{throw Error('disabled');};});
    await page.reload();await page.waitForSelector('.card');assert.equal(await page.locator('.card').count(),games.length);
    await page.locator('.card[data-game="sudoku"]').click();await page.waitForURL('**/games/sudoku/index.html');await page.goBack();
    assert.deepEqual(errors,[]);
    await page.route('**/games/manifest.json',route=>route.fulfill({status:500,body:'error'}));await page.reload();
    assert(await page.locator('#grid .empty').isVisible());
  } finally {await browser.close();await new Promise(r=>server.close(r));}
});
