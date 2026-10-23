'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers/extra-browser.cjs');
const { assembleActions } = require('./helpers/extra-adventure.js');
const games = Object.fromEntries(['fireice', 'tankguard', 'bombergarden', 'buildracer', 'trafficpark'].map(id => [id, require(`../assets/js/extras/${id}.js`)]));
const STICK = '#touch-controls [data-touch-stick]';
const actionSelector = id => `#touch-controls .touch-action[data-action="${id}"]`;
const inputs = page => page.evaluate(() => ExtraGame.inputs().slice().sort());

async function center(page, selector) {
  const rect = await page.locator(selector).first().boundingBox();
  assert.ok(rect && rect.width > 0 && rect.height > 0, `${selector} has a visible hit area`);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height };
}
function runningCar() { const g = games.buildracer, s = g.create(0, 37); for (const [type, p] of assembleActions()) g.act(s, type, p); assert.equal(s.mode, 'run'); return s; }
async function start(ui, id, state) { await ui.install(state || games[id].create(0, 37)); await ui.page.locator('#resume').click(); await ui.page.waitForFunction(() => typeof ExtraGame.inputs === 'function'); }
async function expectInputs(page, expected) { const want = expected.slice().sort(); await page.waitForFunction(want => JSON.stringify(ExtraGame.inputs().slice().sort()) === JSON.stringify(want), want, { timeout: 1500 }); assert.deepEqual(await inputs(page), want); }

// Chromium uses browser-delivered, trusted touch input, including genuine capture,
// isPrimary ordering and compatibility events. WebKit lacks a multi-touch protocol;
// its branch tests the same Pointer Events contract with stable per-finger targets.
async function touches(ui) {
  const points = new Map(), chromium = ui.engine.name() === 'chromium';
  const cdp = chromium ? await ui.page.context().newCDPSession(ui.page) : null;
  let primary = null;
  async function send(type, id, p) {
    if (cdp) { const changed = type === 'up' ? [[id, p]] : [...points]; await cdp.send('Input.dispatchTouchEvent', { type: ({ down: 'touchStart', move: 'touchMove', up: 'touchEnd', cancel: 'touchCancel' })[type], touchPoints: changed.map(([id, q]) => ({ id, x: q.x, y: q.y, radiusX: 7, radiusY: 7, force: 1 })) }); return; }
    await ui.page.evaluate(({ type, id, p, primary }) => {
      const probe = window.__touchControlsProbe || (window.__touchControlsProbe = {}), key = String(id);
      if (type === 'down') probe[key] = document.elementFromPoint(p.x, p.y);
      const target = probe[key]; if (!target) return;
      target.dispatchEvent(new PointerEvent('pointer' + type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 100 + id, isPrimary: id === primary, clientX: p.x, clientY: p.y, button: 0, buttons: type === 'up' || type === 'cancel' ? 0 : 1, width: 14, height: 14 }));
      if (type === 'up' || type === 'cancel') delete probe[key];
    }, { type, id, p, primary });
  }
  return {
    async down(id, p) { if (!points.size) primary = id; assert.ok(!points.has(id)); points.set(id, p); await send('down', id, p); },
    async move(id, p) { assert.ok(points.has(id)); points.set(id, p); await send('move', id, p); },
    async up(id) { const p = points.get(id); if (!p) return; points.delete(id); await send('up', id, p); if (!points.size) primary = null; },
    async cancel() { if (!points.size) return; if (cdp) { points.clear(); await send('cancel'); } else { for (const [id, p] of points) await send('cancel', id, p); points.clear(); } primary = null; },
    async close() { await this.cancel(); if (cdp) await cdp.detach(); }
  };
}

test('touch pad: moving and jumping work in both finger orders, third finger cannot steal steering', { timeout: 60000 }, async t => {
  const ui = await setup(); t.after(() => ui.close());
  for (const actionFirst of [false, true]) {
    await start(ui, 'fireice'); const driver = await touches(ui), stick = await center(ui.page, STICK), jump = await center(ui.page, actionSelector('jump'));
    const right = { x: stick.x + stick.width * .34, y: stick.y }, left = { x: stick.x - stick.width * .34, y: stick.y }, initial = await ui.snap();
    if (actionFirst) await driver.down(2, jump);
    await driver.down(1, stick); await driver.move(1, right);
    if (!actionFirst) await driver.down(2, jump);
    await expectInputs(ui.page, ['jump', 'right']);
    await ui.page.waitForTimeout(140); const moving = await ui.snap();
    assert.ok(moving.chars[0].x > initial.chars[0].x + 8, 'movement continues while jumping');
    assert.ok(moving.chars[0].y < initial.chars[0].y - 20, 'independent finger triggers an actual jump');
    await driver.down(3, left); await driver.move(3, { x: left.x - 30, y: left.y }); await expectInputs(ui.page, ['jump', 'right']);
    await driver.up(3); await expectInputs(ui.page, ['jump', 'right']);
    await driver.up(1); await expectInputs(ui.page, ['jump']);
    await driver.up(2); await expectInputs(ui.page, []); const ended = await ui.snap(); assert.equal(ended.keys.left, false); assert.equal(ended.keys.right, false); assert.equal(ended.keys.jump, false);
    await driver.close();
  }
});

test('touch pad: tank moves and shoots together, outside capture steers and pause releases every source', { timeout: 60000 }, async t => {
  const ui = await setup(); t.after(() => ui.close()); await start(ui, 'tankguard');
  const driver = await touches(ui), stick = await center(ui.page, STICK), fire = await center(ui.page, actionSelector('fire')), initial = await ui.snap();
  await driver.down(2, fire); await driver.down(1, stick); await driver.move(1, { x: stick.x + stick.width * .35, y: stick.y });
  await expectInputs(ui.page, ['fire', 'right']); await ui.page.waitForTimeout(190);
  const moving = await ui.snap(); assert.ok(moving.player.x > initial.player.x + 12); assert.ok(moving.bullets.some(b => !b.enemy) || moving.player.fire > 0, 'moving tank actually fires');
  const outside = { x: Math.min(ui.page.viewportSize().width - 4, stick.x + stick.width + 150), y: stick.y };
  assert.ok(outside.x > stick.x + stick.width / 2); await driver.move(1, outside); await expectInputs(ui.page, ['fire', 'right']);
  await driver.move(1, stick); await expectInputs(ui.page, ['fire']);
  await driver.move(1, { x: stick.x, y: stick.y - stick.height * .35 }); await expectInputs(ui.page, ['fire', 'up']);
  await ui.page.locator('#pause').click(); await expectInputs(ui.page, []); assert.equal(await ui.page.evaluate(() => ExtraGame.paused()), true); assert.deepEqual((await ui.snap()).held, []);
  await driver.up(1); await driver.up(2); await ui.page.locator('#resume').click(); await expectInputs(ui.page, []);
  const stopped = (await ui.snap()).player; await ui.page.waitForTimeout(120); const still = (await ui.snap()).player; assert.equal(still.x, stopped.x); assert.equal(still.y, stopped.y);
  await driver.down(1, stick); await driver.move(1, { x: stick.x + stick.width * .35, y: stick.y }); await driver.down(2, fire); await expectInputs(ui.page, ['fire', 'right']);
  await ui.page.setViewportSize({ width: 768, height: 1024 }); await expectInputs(ui.page, []); assert.deepEqual((await ui.snap()).held, [], 'rotation cancels old coordinates instead of leaving steering stuck'); await driver.up(1); await driver.up(2);
  await driver.close();
});

test('touch pad: bubble is placed on press, steering remains independent and releasing does not repeat an action', { timeout: 60000 }, async t => {
  const ui = await setup(); t.after(() => ui.close()); await start(ui, 'bombergarden');
  const driver = await touches(ui), stick = await center(ui.page, STICK), bomb = await center(ui.page, actionSelector('bomb')), shield = await center(ui.page, actionSelector('shield')), original = await ui.snap();
  await driver.down(2, bomb); const placed = await ui.snap(); assert.equal(placed.bombs.length, 1, 'bomb responds before lifting the action finger'); assert.equal(placed.bombs[0].x, original.player.x); assert.equal(placed.bombs[0].y, original.player.y);
  await driver.down(1, stick); await driver.move(1, { x: stick.x + stick.width * .35, y: stick.y }); await ui.page.waitForTimeout(180);
  assert.ok((await ui.snap()).player.x > original.player.x, 'second finger steers away from the bubble');
  await driver.down(3, shield); const protectedState = await ui.snap(); assert.equal(protectedState.shields, original.shields - 1); assert.ok(protectedState.invuln > 2);
  await driver.up(3); await driver.up(2); assert.equal((await ui.snap()).bombs.length, 1); assert.equal((await ui.snap()).shields, original.shields - 1);
  assert.ok((await inputs(ui.page)).includes('right')); await driver.cancel(); await expectInputs(ui.page, []); assert.deepEqual((await ui.snap()).held, []); await driver.close();
});

test('touch pad: racer pedals are independent and returning to construction clears held inputs', { timeout: 60000 }, async t => {
  const ui = await setup(); t.after(() => ui.close());
  for (const first of ['brake', 'boost']) {
    await start(ui, 'buildracer', runningCar()); const driver = await touches(ui), second = first === 'brake' ? 'boost' : 'brake';
    assert.equal(await ui.page.locator(STICK).isVisible().catch(() => false), false, 'racer uses two pedals instead of a direction stick');
    await driver.down(1, await center(ui.page, actionSelector(first))); await driver.down(2, await center(ui.page, actionSelector(second))); await expectInputs(ui.page, ['brake', 'boost']);
    const fuel = (await ui.snap()).car.fuel; await ui.page.waitForTimeout(160); const driven = await ui.snap(); assert.equal(driven.keys.brake, true); assert.equal(driven.keys.boost, true); assert.ok(Math.abs(driven.car.fuel - fuel) < .02, 'brake takes priority and preserves fuel');
    const boostId = first === 'boost' ? 1 : 2, brakeId = first === 'brake' ? 1 : 2; await driver.up(brakeId); await expectInputs(ui.page, ['boost']);
    const leftFuel = (await ui.snap()).car.fuel; await ui.page.waitForTimeout(100); assert.ok((await ui.snap()).car.fuel < leftFuel - .04, 'releasing brake keeps the other finger boosting');
    await driver.up(boostId); await expectInputs(ui.page, []); const stoppedFuel = (await ui.snap()).car.fuel; await ui.page.waitForTimeout(80); assert.ok(Math.abs((await ui.snap()).car.fuel - stoppedFuel) < .02, 'released boost stops using fuel');
    await driver.down(1, await center(ui.page, actionSelector('boost'))); await driver.down(2, await center(ui.page, actionSelector('brake'))); await driver.down(3, await center(ui.page, actionSelector('edit')));
    assert.equal((await ui.snap()).mode, 'build'); await expectInputs(ui.page, []); assert.deepEqual((await ui.snap()).keys, { boost: false, brake: false });
    await driver.up(3); await driver.up(2); await driver.up(1); await driver.close();
  }
});

test('touch pad: keyboard and touch ownership are merged, cancelling one source preserves the other', { timeout: 60000 }, async t => {
  const ui = await setup(); t.after(() => ui.close()); await start(ui, 'fireice'); const driver = await touches(ui), stick = await center(ui.page, STICK), right = { x: stick.x + stick.width * .35, y: stick.y };
  await ui.page.locator(actionSelector('jump')).focus(); await ui.page.keyboard.down('ArrowRight'); await expectInputs(ui.page, ['right']);
  await driver.down(1, stick); await driver.move(1, right); await ui.page.keyboard.up('ArrowRight'); await expectInputs(ui.page, ['right']);
  await ui.page.keyboard.down('ArrowRight'); await driver.cancel(); await expectInputs(ui.page, ['right']); assert.equal((await ui.snap()).keys.right, true);
  await ui.page.keyboard.up('ArrowRight'); await expectInputs(ui.page, []);
  await ui.page.keyboard.down('ArrowLeft'); await driver.down(1, stick); await driver.move(1, right); await ui.page.evaluate(() => window.dispatchEvent(new Event('blur'))); await expectInputs(ui.page, []); assert.equal(await ui.page.evaluate(() => ExtraGame.paused()), true);
  await ui.page.keyboard.up('ArrowLeft'); await driver.up(1); await ui.page.locator('#resume').click(); await expectInputs(ui.page, []);
  await ui.page.locator('#levels').focus(); await ui.page.keyboard.down('ArrowRight'); await expectInputs(ui.page, []); await ui.page.keyboard.up('ArrowRight');
  await driver.close();
});

test('touch pad: iPad landscape, portrait and phone layouts keep controls reachable without page scrolling', { timeout: 90000 }, async t => {
  const ui = await setup(); t.after(() => ui.close());
  for (const id of ['fireice', 'tankguard', 'bombergarden', 'buildracer']) {
    await start(ui, id, id === 'buildracer' ? runningCar() : undefined);
    for (const viewport of [{ width: 1024, height: 650 }, { width: 768, height: 1024 }, { width: 820, height: 560 }, { width: 390, height: 844 }]) {
      await ui.page.setViewportSize(viewport); await ui.page.waitForTimeout(100);
      const layout = await ui.page.evaluate(() => {
        const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
        const visible = element => { const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(element).visibility !== 'hidden'; };
        const elements = [...document.querySelectorAll('#touch-controls .touch-action, #touch-controls [data-touch-stick], #pause, #help')].filter(visible);
        const notes = ['feedback', 'touch-note'].map(id => document.getElementById(id)).filter(element => element && visible(element) && element.textContent.trim()).map(rect);
        return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, board: rect(document.querySelector('#board')), notes, controls: elements.map(element => ({ name: element.dataset.action || element.id || 'stick', stick: element.hasAttribute('data-touch-stick'), ...rect(element) })), actions: [...document.querySelectorAll('#touch-controls .touch-action')].filter(visible).map(rect), stick: [...document.querySelectorAll('#touch-controls [data-touch-stick]')].filter(visible).map(rect) };
      });
      assert.ok(layout.scrollWidth <= viewport.width + 1 && layout.scrollHeight <= viewport.height + 1, `${id} ${viewport.width}×${viewport.height} stays on one screen`);
      assert.ok(layout.board.width >= 150 && layout.board.height >= 160, `${id} playfield remains usable`);
      assert.ok(layout.actions.length >= 2, `${id} has separate action buttons`);
      for (const c of layout.controls) { assert.ok(c.width >= 43.5 && c.height >= 43.5, `${id} ${c.name} has a 44px touch target`); assert.ok(c.x >= -1 && c.y >= -1 && c.right <= layout.width + 1 && c.bottom <= layout.height + 1, `${id} ${c.name} remains visible`); }
      for (const stick of layout.stick) { assert.ok(stick.width >= 95 && stick.height >= 95, 'stick provides room for thumb travel'); for (const action of layout.actions) { const overlap = Math.min(stick.right, action.right) - Math.max(stick.x, action.x) > 1 && Math.min(stick.bottom, action.bottom) - Math.max(stick.y, action.y) > 1; assert.equal(overlap, false, 'independent hands have separate hit areas'); } }
      if (layout.notes.length === 2) { const [a, b] = layout.notes; assert.ok(Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) <= 1, `${id} status and touch instructions do not overlap`); }
    }
  }
  await start(ui, 'trafficpark'); assert.equal(await ui.page.locator(STICK).isVisible().catch(() => false), false, 'discrete parking puzzle keeps direct car dragging');
});
