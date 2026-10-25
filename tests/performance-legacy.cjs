'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers/extra-browser.cjs');
const E = require('../games/fruitcut/engine.js');

function instrument() {
  window.legacyPerf = { frames: 0, gradients: 0, cells: 0, paints: 0, duration: 0, maxPending: 0, sameFrameCallbacks: 0 };
  window.legacyRaf = { pending: new Map(), lastTime: null, times: [] };
  const nativeFrame = requestAnimationFrame;
  const nativeCancel = cancelAnimationFrame;
  window.requestAnimationFrame = callback => {
    const game = /^(frame|loop|gameLoop)$/.test(callback.name);
    const id = nativeFrame(time => {
      legacyRaf.pending.delete(id);
      const before = performance.now();
      if (game) {
        legacyPerf.frames++;
        if (legacyRaf.lastTime === time) legacyPerf.sameFrameCallbacks++;
        legacyRaf.lastTime = time;
        legacyRaf.times.push(time);
      }
      callback(time);
      if (game) legacyPerf.duration += performance.now() - before;
    });
    if (game) {
      legacyRaf.pending.set(id, callback.name);
      legacyPerf.maxPending = Math.max(legacyPerf.maxPending, legacyRaf.pending.size);
    }
    return id;
  };
  window.cancelAnimationFrame = id => {
    legacyRaf.pending.delete(id);
    return nativeCancel(id);
  };
  for (const method of ['createLinearGradient', 'createRadialGradient', 'fillRect', 'drawImage']) {
    const original = CanvasRenderingContext2D.prototype[method];
    CanvasRenderingContext2D.prototype[method] = function (...args) {
      if (method.includes('Gradient')) legacyPerf.gradients++;
      if (this.canvas.isConnected) {
        if (method === 'fillRect') legacyPerf.cells++;
        if (method === 'drawImage') legacyPerf.paints++;
      }
      return original.apply(this, args);
    };
  }
}
const reset = page => page.evaluate(() => {
  for (const key of Object.keys(legacyPerf)) legacyPerf[key] = 0;
  legacyPerf.maxPending = legacyRaf.pending.size;
  legacyRaf.lastTime = null; legacyRaf.times.length = 0;
});
const read = page => page.evaluate(() => ({ ...legacyPerf, pending: legacyRaf.pending.size, times: legacyRaf.times.slice() }));

test('legacy performance core: fruit sweeps retain survivors, scoring and reusable storage', () => {
  const s = E.create(); s.status = 'playing'; s.spawn = 100;
  s.fruits = [0, 1, 2, 3].map(i => ({ id: i, x: 120 + i * 180, y: 300, r: 40, kind: 'melon', entered: true, vx: 0, vy: 0, angle: 0, spin: 0 }));
  const fruits = s.fruits, stroke = { combo: 0 };
  for (let i = 0; i < 1000; i++) assert.equal(E.slash(s, { x: 0, y: 0 }, { x: 900, y: 0 }, stroke).length, 0);
  assert.equal(s.fruits, fruits);
  assert.deepEqual(E.slash(s, { x: 220, y: 300 }, { x: 550, y: 300 }, stroke).map(f => f.id), [1, 2]);
  assert.deepEqual(s.fruits.map(f => f.id), [0, 3]);
  assert.equal(s.score, 25);
  s.fruits[0].y = 900;
  E.step(s, .02);
  assert.equal(s.fruits, fruits);
  assert.deepEqual(s.fruits.map(f => f.id), [3]);
});

test('legacy performance: idle, paused and hidden games stop their animation loops and resume once', { timeout: 90000 }, async () => {
  const h = await setup();
  try {
    await h.page.addInitScript(instrument);
    for (const id of ['snake', 'tetris', 'shooter', 'racing', 'watermelon', 'fruitcut', 'whack', '2048']) {
      await h.page.goto(h.base + `games/${id}/index.html`);
      await h.page.waitForTimeout(160);
      if (['snake', 'watermelon', 'fruitcut', 'whack', '2048'].includes(id)) {
        await reset(h.page); await h.page.waitForTimeout(160);
        const idle = await read(h.page);
        assert.equal(idle.frames, 0, id + ' has no idle game RAF');
        assert.equal(idle.pending, 0, id + ' has no scheduled idle game RAF');
      }
      if (id === '2048') continue;
      if (id === 'snake') await h.page.keyboard.press('ArrowUp');
      if (id === 'watermelon') await h.page.locator('#board').click({ position: { x: 60, y: 45 } });
      if (id === 'fruitcut') await h.page.locator('#play').click();
      if (id === 'whack') await h.page.locator('#mainAction').click();
      await h.page.waitForTimeout(120);
      await h.page.locator('#pause').click();
      await h.page.waitForTimeout(100);
      await reset(h.page); await h.page.waitForTimeout(180);
      const stopped = await read(h.page);
      assert.equal(stopped.frames, 0, id + ' paused RAF');
      assert.equal(stopped.paints, 0, id + ' paused paint');
      assert.equal(stopped.pending, 0, id + ' has no scheduled paused RAF');
      if (id === 'fruitcut') await h.page.locator('#play').click();
      else if (id === 'whack') await h.page.locator('#mainAction').click();
      else await h.page.locator('#pause').click();
      await reset(h.page);
      if (id !== 'whack') await h.page.waitForFunction(() => legacyPerf.frames > 0);
      await h.page.waitForTimeout(180);
      const playing = await read(h.page);
      if (process.env.LEGACY_RAF_TRACE) console.log('legacy RAF', id, JSON.stringify(playing));
      if (id !== 'whack') {
        assert.ok(playing.frames > 0, id + ' resumes rendering');
        // Refresh cadence differs across browsers/displays. Check outstanding work
        // and duplicate callbacks directly instead of assuming a fixed frame rate.
        assert.equal(playing.pending, 1, id + ' has one scheduled game RAF');
        assert.equal(playing.maxPending, 1, id + ' never schedules parallel game RAFs');
        assert.equal(playing.sameFrameCallbacks, 0, id + ' runs once per animation frame');
      } else {
        assert.equal(playing.frames, 0, 'whack clock does not need animation frames');
        assert.equal(playing.pending, 0, 'whack clock does not schedule animation frames');
      }
      await h.page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await h.page.waitForTimeout(80); await reset(h.page); await h.page.waitForTimeout(160);
      const hidden = await read(h.page);
      assert.equal(hidden.frames, 0, id + ' hidden RAF');
      assert.equal(hidden.pending, 0, id + ' has no scheduled hidden RAF');
      await h.page.evaluate(() => {
        delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }
  } finally { await h.close(); }
});

test('legacy performance: cached canvas artwork avoids repeated gradients and grid rebuilds', { timeout: 45000 }, async () => {
  const h = await setup();
  try {
    await h.page.addInitScript(instrument);
    await h.page.goto(h.base + 'games/watermelon/index.html');
    const watermelon = await h.page.evaluate(() => {
      bodies = [makeBody(0, 150, 400), makeBody(0, 165, 400)];
      physicsStep(FIXED_STEP);
      const merged = bodies.length === 1 && bodies[0].level === 1 && score === FRUITS[1].points;
      bodies = [makeBody(8, 200, 500, 20, 300)];
      for (let i = 0; i < 120; i++) physicsStep(FIXED_STEP);
      const bounded = bodies.every(b => Number.isFinite(b.x + b.y + b.vx + b.vy) && b.y + b.radius <= WORLD_H + .01);
      bodies = FRUITS.map((f, level) => makeBody(level, 100 + level % 3 * 100, 200 + Math.floor(level / 3) * 140));
      drawOrderDirty = true; draw();
      legacyPerf.gradients = 0;
      const before = performance.now();
      for (let i = 0; i < 60; i++) draw();
      return { gradients: legacyPerf.gradients, count: drawOrder.length, images: fruitImages.size, merged, bounded, ms: performance.now() - before };
    });
    assert.equal(watermelon.gradients, 0);
    assert.equal(watermelon.count, 9);
    assert.equal(watermelon.images, 9);
    assert.ok(watermelon.merged && watermelon.bounded, 'merges and fixed-step bounds are preserved');
    await h.page.goto(h.base + 'games/tetris/index.html');
    const tetris = await h.page.evaluate(() => {
      drawBoard(); legacyPerf.cells = 0;
      for (let i = 0; i < 60; i++) drawBoard();
      const cells = legacyPerf.cells;
      let collisionsMatch = true;
      for (let rotation = 0; rotation < 4; rotation++) for (let x = -2; x < 12; x++) for (let y = -2; y < 21; y++) {
        const reference = cellsOf(active, rotation, x, y).some(c => c.x < 0 || c.x >= COLS || c.y >= ROWS || c.y >= 0 && Boolean(board[c.y][c.x]));
        if (collides(active, rotation, x, y) !== reference) collisionsMatch = false;
      }
      hardDrop();
      return { cells, collisionsMatch, locked: board.flat().filter(Boolean).length, validCache: !settledDirty };
    });
    assert.equal(tetris.cells, 0, 'static grid and locked blocks are cached');
    assert.ok(tetris.collisionsMatch);
    assert.equal(tetris.locked, 4);
    assert.ok(tetris.validCache, 'locking refreshes the cached board');
    await h.page.goto(h.base + 'games/shooter/index.html');
    const shooter = await h.page.evaluate(() => {
      draw(); legacyPerf.gradients = 0;
      for (let i = 0; i < 60; i++) draw();
      return legacyPerf.gradients;
    });
    assert.equal(shooter, 0, 'sky gradient survives consecutive frames');
    await h.page.goto(h.base + 'games/fruitcut/index.html');
    await h.page.locator('#play').click();
    await h.page.waitForTimeout(500);
    await h.page.evaluate(() => {
      window.timeMutations = 0;
      window.timeObserver = new MutationObserver(records => timeMutations += records.length);
      timeObserver.observe(document.querySelector('#time'), { childList: true, subtree: true, characterData: true });
    });
    await reset(h.page); await h.page.waitForTimeout(1200);
    assert.equal((await read(h.page)).gradients, 0, 'fruitcut background does not rebuild per frame');
    assert.ok(await h.page.evaluate(() => { timeObserver.disconnect(); return timeMutations <= 2; }), 'clock changes only at a displayed second');
    await h.capture('legacy-performance-fruitcut');
    console.log('cached watermelon 60 redraws:', JSON.stringify(watermelon));
  } finally { await h.close(); }
});

test('legacy performance: whack second timer keeps deadline and pauses without polling', { timeout: 30000 }, async () => {
  const h = await setup();
  try {
    await h.page.goto(h.base + 'games/whack/index.html');
    await h.page.clock.install();
    await h.page.locator('#mainAction').click();
    await h.page.clock.runFor(2200);
    assert.equal(await h.page.locator('#time').textContent(), '43');
    await h.page.locator('#pause').click();
    await h.page.clock.runFor(5000);
    assert.equal(await h.page.locator('#time').textContent(), '43');
    assert.equal(await h.page.evaluate(() => clockTimer), 0);
    await h.page.locator('#mainAction').click();
    await h.page.clock.runFor(43000);
    assert.equal(await h.page.evaluate(() => state), 'ended');
    assert.equal(await h.page.locator('#time').textContent(), '0');
    assert.equal(await h.page.evaluate(() => clockTimer), 0);
  } finally { await h.close(); }
});
