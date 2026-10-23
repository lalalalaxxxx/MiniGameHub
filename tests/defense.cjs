const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium, webkit } = require('playwright'), C = require('../assets/js/defense-core.js');
const placements = id => id === 'gardenwatch' ? [0, 8, 16, 24, 32] : [9, 11, 13, 25, 27, 29];
test('Automatic waves: initial preparation, ten-second breaks, legacy saves and rising difficulty',()=>{
  for(const id of ['gardenwatch','toydefense']){
    const s=C.fresh(id,'easy');for(let i=0;i<200;i++)C.tick(s,.1);assert.equal(s.wave,0);
    for(const cell of placements(id))C.build(s,cell,0);C.start(s);
    let previousHp=0,previousCount=0,previousGap=2;
    for(let wave=1;wave<=6;wave++){
      C.tick(s,.1);assert(s.enemies[0].max>previousHp);assert(C.count(s)>previousCount);assert(s.spawnIn<previousGap);
      previousHp=s.enemies[0].max;previousCount=C.count(s);previousGap=s.spawnIn;
      for(let i=0;i<10000&&s.phase==='running';i++)C.tick(s,.1);
      assert.equal(s.phase,wave===6?'won':'ready');
      if(wave===6)break;
      assert.equal(s.breakLeft,10);
      const old=C.clone(s);delete old.breakLeft;assert.equal(C.restore(id,old).breakLeft,10);
      for(const t of s.towers)while(C.upgrade(s,t.cell)){}
      for(let i=0;i<99;i++)assert(!C.tick(s,.1).some(e=>e.kind==='start'));
      assert.equal(s.phase,'ready');assert(C.tick(s,.1).some(e=>e.kind==='start'));assert.equal(s.wave,wave+1);
    }
    const won=C.clone(s);for(let i=0;i<200;i++)C.tick(s,.1);assert.deepEqual(s,won);
  }
});
test('Defense animation frames, impact lifetimes, reduced motion and bounded particles',()=>{
  const F=require('../assets/js/defense-fx.js'),fx=F.fresh();
  F.advance(fx,0,[{kind:'shot',cell:0,type:1,x:.5,y:.5,tx:5,ty:.5},{kind:'hurt',id:7},{kind:'impact',x:5,y:.5,type:1},{kind:'clear',x:5,y:.5}]);
  assert.equal(F.frame(fx,0),4);assert.equal(F.frame(fx,0,true),5);assert(fx.hurt[7]);assert.match(F.particles(fx),/reward-pop/);
  const frames=new Set();for(let n=0;n<30;n++){frames.add(F.frame(fx,0));F.advance(fx,.016);}
  for(const n of [4,5,6,7,8,9])assert(frames.has(n));F.advance(fx,1);assert.equal(fx.bursts.length,0);assert.equal(F.frame(fx,0,true),0);assert.deepEqual(fx.hurt,{});
  F.advance(fx,0,Array.from({length:150},()=>({kind:'impact',x:1,y:1,type:2})));assert.equal(fx.bursts.length,100);assert(!F.particles(fx,true).includes('<path'));
});
test('Defense rules: six waves at both difficulties, economics, targeting, damage, saves and defeat', () => {
  for (const id of ['gardenwatch', 'toydefense']) for (const difficulty of ['easy', 'normal']) {
    const s = C.fresh(id, difficulty);if(difficulty==='normal')delete s.rules;
    assert(!C.build(s, id === 'gardenwatch' ? 7 : 0, 0));
    for (const cell of placements(id)) assert(C.build(s, cell, 0));
    assert(!C.build(s, placements(id)[0], 0));
    for (let wave = 1; wave <= 6; wave++) {
      for (const t of s.towers) while (C.upgrade(s, t.cell)) {}
      assert(C.start(s)); assert(!C.start(s));
      let ticks = 0;
      while (s.phase === 'running' && ticks++ < 10000) { C.tick(s, .1); assert.deepEqual(C.restore(id, s), s); }
      assert.equal(s.wave, wave); assert.equal(s.phase, wave === 6 ? 'won' : 'ready'); assert(s.hearts > 0);
    }
    const won = C.clone(s); C.tick(s, .1); assert(!C.start(s)); assert.deepEqual(s, won); assert.equal(s.cleared, 72);
  }
  const economy = C.fresh('gardenwatch','easy'); C.build(economy, 0, 0); C.upgrade(economy, 0); C.upgrade(economy, 0); assert(!C.upgrade(economy, 0)); assert(C.sell(economy, 0)); assert.equal(economy.coins, 189); assert(!C.sell(economy, 0));
  const enemy = (id, p, lane) => ({ id, p, lane, hp: 100, max: 100, slow: 0 });
  for (const type of [0, 1, 2]) {
    const s = C.fresh('gardenwatch'); C.build(s, 0, type); C.start(s); s.spawnIn = 1; s.enemies = [enemy(1, 2, 0), enemy(2, 2.2, 0), enemy(3, 2, 3)];
    C.tick(s, .1); assert.equal(s.enemies[1].hp, 100); assert.equal(s.projectiles.length, 1); const shotX = s.projectiles[0].x; C.tick(s, .1); assert(s.projectiles[0].x > shotX); assert.deepEqual(C.restore(s.id, s), s); for(let i=0;i<10 && s.enemies[1].hp===100;i++)C.tick(s,.1); assert(s.enemies[1].hp < 100); assert.equal(s.enemies[2].hp, 100); assert.equal(s.enemies[0].hp < 100, type === 1); assert.equal(s.enemies[1].slow > 0, type === 2);
  }
  const loss = C.fresh('toydefense', 'normal'); for (let n = 0; n < 3 && loss.phase !== 'lost'; n++) { C.start(loss); for (let i = 0; i < 10000 && loss.phase === 'running'; i++) C.tick(loss, .1); } assert.equal(loss.phase, 'lost'); assert.equal(loss.hearts, 0); const lost = C.clone(loss); C.tick(loss, .1); assert.deepEqual(loss, lost);
  for (const raw of [null, {}, { ...C.fresh('gardenwatch'), coins: NaN }, { ...C.fresh('gardenwatch'), towers: [null] }, { ...C.fresh('gardenwatch'), enemies: [{ hp: Infinity }] }]) assert.deepEqual(C.restore('gardenwatch', raw), C.fresh('gardenwatch'));
});
test('Defense touch flows: full games, paused restore, upgrades, dialogs, layouts and blocked storage', { timeout: 360000 }, async () => {
  const root = path.resolve(__dirname, '..'), mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => { const file = path.join(root, new URL(req.url, 'http://localhost').pathname); fs.readFile(file, (error, bytes) => { if (error) { res.writeHead(404); res.end(); return; } res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(bytes); }); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const engine = process.env.TEST_BROWSER === 'webkit' ? webkit : chromium;
  const browser = await engine.launch({ headless: true, ...(engine === chromium ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}) });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, serviceWorkers: 'block' }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.install();
    const snap = () => page.evaluate(() => DefenseGame.snapshot()), cell = n => page.locator(`[data-cell="${n}"]`);
    for (const id of ['gardenwatch', 'toydefense']) {
      await page.goto(`http://127.0.0.1:${server.address().port}/games/${id}/index.html`);
      assert.equal(await page.locator('.cell').count(), 40);await page.locator('#difficulty').selectOption('easy');await page.locator('#confirm').tap();
      await page.locator('[data-type="1"]').tap(); await cell(placements(id)[0]).tap(); assert.equal((await snap()).towers[0].type, 1);
      await page.locator('#upgrade').tap(); assert.equal((await snap()).towers[0].level, 2); await page.locator('#sell').tap(); assert.equal((await snap()).towers.length, 0);
      await page.locator('#restart').tap(); await page.locator('#confirm').tap();
      for (const at of placements(id)) await cell(at).tap();
      await page.locator('#start').tap(); await page.clock.runFor(2400);
      if(id==='gardenwatch'){assert((await snap()).projectiles.length>0);assert(await page.locator('.projectile').count()>0);assert.equal(await page.locator('#actors line').count(),0);assert(Number(await cell(0).locator('.defender').getAttribute('data-frame'))>=4);}
      await page.locator('#pause').tap(); const paused = await snap(), pausedFX=await page.evaluate(()=>DefenseGame.effects()); await page.clock.runFor(2000); assert.deepEqual(await snap(), paused);assert.deepEqual(await page.evaluate(()=>DefenseGame.effects()),pausedFX);
      await page.reload(); assert.deepEqual(await snap(), paused); assert(await page.evaluate(() => DefenseGame.paused())); await page.clock.runFor(1000); assert.deepEqual(await snap(), paused);
      await page.locator('#help').tap(); await page.clock.runFor(1000); assert.deepEqual(await snap(), paused); await page.locator('#confirm').tap();
      await page.locator('#pause').tap(); await page.locator('#speed').tap();
      for (let wave = 1; wave <= 6; wave++) {
        if (wave > 1) {
          if(wave===2){
            await page.locator('#pause').tap();const rest=await snap();await page.clock.runFor(12000);assert.deepEqual(await snap(),rest);
            await page.reload();assert(await page.evaluate(()=>DefenseGame.paused()));assert.deepEqual(await snap(),rest);
            await page.locator('#pause').tap();await page.locator('#speed').tap();await page.locator('#help').tap();const help=await snap();await page.clock.runFor(12000);assert.deepEqual(await snap(),help);await page.locator('#confirm').tap();
          }
          for (const at of placements(id)) { await cell(at).tap(); while (await page.locator('#upgrade').isEnabled()) await page.locator('#upgrade').tap(); }
          await page.clock.runFor(4000);assert.equal((await snap()).phase,'ready');
          await page.clock.runFor(6500);assert.equal((await snap()).wave,wave);assert.equal((await snap()).phase,'running');
        }
        for (let i = 0; i < 70 && (await snap()).phase === 'running'; i++) await page.clock.runFor(1000);
        assert.equal((await snap()).phase, wave === 6 ? 'won' : 'ready');
      }
      assert(await page.locator('#finish').isVisible()); const completed = await snap(); await page.reload(); assert.deepEqual(await snap(), completed);
      await page.locator('#restart').tap(); await page.locator('#cancel').tap(); assert.deepEqual(await snap(), completed);
      await page.locator('#difficulty').selectOption('normal'); await page.locator('#cancel').tap(); assert.equal((await snap()).difficulty, 'easy');
      await page.locator('#difficulty').selectOption('normal'); await page.locator('#confirm').tap(); assert.equal((await snap()).difficulty, 'normal'); assert.equal((await snap()).wave, 0);
      for (const at of placements(id)) await cell(at).tap(); await page.locator('#start').tap(); await page.clock.runFor(1500); await page.locator('#pause').tap();
      for (const viewport of [{ width: 820, height: 1180 }, { width: 390, height: 844 }, { width: 1180, height: 820 }]) { await page.setViewportSize(viewport); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); const box = await cell(0).boundingBox(); assert(box.width >= 40); }
      await page.screenshot({ path: path.join(os.tmpdir(), `defense-${id}.png`), fullPage: true });
      await page.locator('#sound').tap(); await page.locator('#sound').tap();
      console.log(`PASS ${id}: six waves through touch UI and paused persistence`);
    }
    await ctx.addInitScript(() => { Storage.prototype.getItem = () => { throw Error('blocked'); }; Storage.prototype.setItem = () => { throw Error('blocked'); }; });
    await page.goto(`http://127.0.0.1:${server.address().port}/games/gardenwatch/index.html`); await cell(0).tap(); assert.equal((await snap()).towers.length, 1); assert.match(await page.locator('#save-status').textContent(), /无法保存/); assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
});
