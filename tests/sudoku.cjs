const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../games/sudoku/engine.js');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium,webkit}=require('playwright');
test('Sudoku generation: unique, valid and solvable without guessing',()=>{
  for(const mode of Object.keys(E.modes))for(let sample=0;sample<100;sample++){
    const p=E.generate(mode),n=E.modes[mode].size;
    assert.equal(p.givens.length,n*n);assert(p.givens.some(v=>!v));
    assert(p.givens.filter(Boolean).length>=E.modes[mode].clues);
    for(const group of E.groups(n))assert.equal(new Set(group.cells.map(i=>p.solution[i])).size,n);
    assert.deepEqual(E.solve(p.givens,n),[p.solution]);assert.deepEqual(E.logical(p.givens,n),p.solution);
    const b=p.givens.slice();while(b.includes(0)){const step=E.next(b,n);assert(step);assert.equal(step.value,p.solution[step.index]);b[step.index]=step.value;}
  }
  assert.deepEqual(E.solve([1,1,...Array(14).fill(0)],4),[]);
});
test('Sudoku touch, notes, hints, checking, undo, modes, save and layouts',{timeout:90000},async()=>{
  const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/games/sudoku/index.html`);
    const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('childgame.sudoku.v1')));
    const cell=i=>page.locator(`[data-cell="${i}"]`),number=n=>page.locator(`[data-number="${n}"]`);
    let s=await saved();assert.equal(await page.locator('.cell').count(),16);
    const given=s.givens.findIndex(Boolean),empty=s.givens.indexOf(0);
    await cell(given).tap();await number(1).tap();assert.deepEqual((await saved()).values,s.values);
    await cell(empty).tap();await page.locator('#notes').tap();await number(s.solution[empty]).tap();assert.deepEqual((await saved()).notes[empty],[s.solution[empty]]);assert.equal((await saved()).values[empty],0);
    await number(s.solution[empty]).tap();assert.deepEqual((await saved()).notes[empty],[]);
    await number(s.solution[empty]).tap();await page.locator('#notes').tap();await number(s.solution[empty]).tap();assert.equal((await saved()).values[empty],s.solution[empty]);assert.deepEqual((await saved()).notes[empty],[]);
    await page.locator('#undo').tap();assert.equal((await saved()).values[empty],0);assert.deepEqual((await saved()).notes[empty],[s.solution[empty]]);
    await page.locator('#erase').tap();assert.deepEqual((await saved()).notes[empty],[]);
    const neighbor=E.peers(empty,4).find(i=>s.givens[i]);await number(s.givens[neighbor]).tap();assert(await cell(empty).evaluate(el=>el.classList.contains('conflict')));
    await page.locator('#check').tap();assert(await page.locator('.conflict').count()>0);await page.locator('#hint').tap();assert.equal(await cell(empty).getAttribute('aria-pressed'),'true');await page.locator('#erase').tap();
    const beforeHint=(await saved()).values;await page.locator('#hint').tap();assert.deepEqual((await saved()).values,beforeHint);assert.equal(await page.locator('#hint').textContent(),'填入这个提示');await page.locator('#hint').tap();assert.equal((await saved()).values.filter(Boolean).length,beforeHint.filter(Boolean).length+1);
    await page.locator('#restart').tap();assert(await page.locator('#dialog').evaluate(el=>el.open));await page.locator('#cancel').tap();assert.deepEqual((await saved()).givens,s.givens);
    await page.locator('[data-mode="easy"]').tap();await page.locator('#confirm').tap();s=await saved();assert.equal(s.mode,'easy');assert.equal(await page.locator('.cell').count(),36);assert.equal(await page.locator('.box-right').count(),6);assert.equal(await page.locator('.box-bottom').count(),12);
    const i=s.givens.indexOf(0);await cell(i).tap();await page.keyboard.press(String(s.solution[i]));assert.equal((await saved()).values[i],s.solution[i]);
    await page.locator('#symbols').tap();assert.equal(await page.locator('.mark').count(),0);
    const snapshot=await saved();await page.reload();assert.deepEqual(await saved(),snapshot);assert.equal(await page.locator('.mark').count(),0);
    await page.locator('#rules').tap();assert(await page.locator('#dialog').evaluate(el=>el.open));await page.keyboard.press('Escape');assert(!await page.locator('#dialog').evaluate(el=>el.open));
    await page.locator('[data-mode="challenge"]').tap();await page.locator('#confirm').tap();s=await saved();assert.equal(s.mode,'challenge');
    // Complete the puzzle through explanation-first hints, not test-only mutations.
    const blanks=s.values.filter(v=>!v).length;for(let j=0;j<blanks;j++){await page.locator('#hint').tap();await page.locator('#hint').tap();}
    assert(await page.locator('#success').isVisible());assert.deepEqual((await saved()).values,s.solution);await page.locator('#undo').tap();assert(await page.locator('#success').isHidden());
    await page.locator('#restart').tap();await page.locator('#confirm').tap();assert.equal((await saved()).mode,'challenge');
    for(const viewport of [{width:1180,height:820},{width:820,height:1180},{width:390,height:844}]){await page.setViewportSize(viewport);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const bounds=await cell(0).boundingBox();assert(bounds.width>=44);assert(await page.locator('#rules').isVisible());}
    await page.setViewportSize({width:1180,height:820});await page.screenshot({path:path.join(os.tmpdir(),'sudoku-preview.png'),fullPage:true});
    await page.evaluate(()=>localStorage.setItem('childgame.sudoku.v1','{"version":1,"mode":"__proto__"}'));await page.reload();assert.equal((await saved()).mode,'first');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});
