'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers/extra-browser.cjs');
const { games, plan, point } = require('./helpers/extra-puzzles.js');

test('town touch placement, storage, hammer, saved resume and a real first-level win', { timeout: 60000 }, async t => {
  const ui = await setup(); t.after(() => ui.close()); const { page } = ui;
  await ui.install(games.tripletown.create(0, 37)); await page.locator('#resume').click();
  await page.locator('[data-action="store"]').click(); assert.equal((await ui.snap()).bank, 1); assert.equal(await page.locator('[data-action="store"]').isDisabled(), true);
  await ui.tap(point(12)); assert.equal((await ui.snap()).board[12], 2); assert.equal((await ui.snap()).score, 20);
  await page.locator('[data-action="store"]').click(); assert.equal((await ui.snap()).bank, 2);
  await page.locator('[data-action="hammer"]').click(); await ui.tap(point(0)); assert.equal((await ui.snap()).hammers, 2); await ui.tap(point(12)); assert.equal((await ui.snap()).board[12], 0); assert.equal((await ui.snap()).hammers, 1);
  await ui.install(games.tripletown.create(0, 37)); await page.locator('#resume').click(); const actions = plan('tripletown', 0, 37);
  await ui.tap(actions[0].payload); const saved = await ui.snap(); await ui.capture('tripletown-play');
  await page.reload(); await page.waitForFunction(() => window.ExtraGame); assert.equal(await page.evaluate(() => ExtraGame.paused()), true); const loaded = await ui.snap(); assert.equal(loaded.moves, saved.moves); assert.deepEqual(loaded.board, saved.board);
  await page.locator('#resume').click(); for (const a of actions.slice(1)) await ui.tap(a.payload);
  await ui.result(); assert.equal((await ui.snap()).stars, 3); await page.locator('#resume').click(); assert.equal((await ui.snap()).level, 1); assert.equal((await ui.snap()).phase, 'playing');
});

test('water touch excavation, valve control, moving fluid and a three-duck first-level win', { timeout: 60000 }, async t => {
  const ui = await setup(); t.after(() => ui.close()); const { page } = ui;
  await ui.install(games.waterworks.create(0, 37)); await page.locator('#resume').click();
  await page.locator('[data-action="water"]').click(); await page.waitForTimeout(650); assert.ok((await ui.snap()).drops.length > 5); assert.equal((await ui.snap()).collected, 0);
  await page.locator('[data-action="water"]').click(); const emitted = (await ui.snap()).emitted; await page.waitForTimeout(160); assert.equal((await ui.snap()).emitted, emitted);
  const route = games.waterworks.solution(0); for (let i = 1; i < route.length; i++) await ui.drag(route[i - 1], route[i]);
  assert.ok((await ui.snap()).dug > 100); assert.equal((await ui.snap()).open, false); await page.locator('[data-action="water"]').click(); await page.waitForTimeout(700); await ui.capture('waterworks-flow');
  await ui.result(); const won = await ui.snap(); assert.equal(won.stars, 3); assert.ok(won.collected >= won.goal); assert.equal(won.emitted, won.collected + won.lost + won.drops.length);
});

test('parking gestures respect blocked cells and axis, then drive the red car through the exit', { timeout: 60000 }, async t => {
  const ui = await setup(); t.after(() => ui.close()); const { page } = ui;
  const g = games.trafficpark; await ui.install(g.create(9, 37)); await page.locator('#resume').click(); const start = await ui.snap(), p = g.center(start.cars[0]);
  await ui.drag(p, { x: p.x + 400, y: p.y }); assert.equal((await ui.snap()).cars[0].x, 0); assert.equal((await ui.snap()).moves, 0);
  const v = g.center(start.cars[2]); await ui.drag(v, { x: v.x + 200, y: v.y }); const same = await ui.snap(); assert.equal(same.cars[2].x, start.cars[2].x); assert.equal(same.cars[2].y, start.cars[2].y); assert.equal(same.moves, 0); assert.equal(await page.locator('[data-action="up"]').count(), 1);
  await ui.capture('trafficpark-puzzle');
  await ui.install(g.create(0, 37)); await page.locator('#resume').click(); const a = plan('trafficpark', 0, 37)[0]; await ui.drag(a.payload.start, a.payload); await ui.result(); assert.equal((await ui.snap()).stars, 3); assert.equal((await ui.snap()).moves, 1);
});
