'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { games, plan, point } = require('./helpers/extra-puzzles.js');
const clone = s => JSON.parse(JSON.stringify(s));
function advance(g, s, seconds) { for (let i = 0; i < seconds * 120 && s.phase === 'playing'; i++) g.step(s, 1 / 120); }

test('all thirty puzzle levels are legally solvable with original pointer gestures', () => {
  for (const id of Object.keys(games)) for (const seed of [1, 37, 91]) for (let level = 0; level < 10; level++) {
    const g = games[id], s = g.create(level, seed);
    assert.equal(g.validate(s), true, `${id} fresh save rejected`);
    for (const a of plan(id, level, seed)) { if (a.wait) advance(g, s, a.wait); else assert.equal(g.act(s, a.type, a.payload).ok, true, `${id} level ${level} rejected ${a.type}`); assert.equal(g.validate(clone(s)), true, `${id} live save rejected`); }
    assert.equal(s.phase, 'won', `${id}, level ${level}, seed ${seed}`); assert.ok(s.stars >= 1);
    if (id !== 'tripletown') assert.equal(s.stars, 3);
    const terminal = clone(s); for (let i = 0; i < 40; i++) g.step(s, 1 / 120); assert.deepEqual(s, terminal, `${id} terminal snapshot stays fixed`);
  }
});

test('town merges orthogonal groups and chains at the placed cell; diagonal tiles do not merge', () => {
  const g = games.tripletown, s = g.create(9, 4); s.board = Array(36).fill(0); s.current = 1; s.goal = 99999;
  s.board[12] = 1; s.board[7] = 1; s.board[2] = 2; s.board[3] = 2;
  const r = g.act(s, 'place', { index: 13 }); assert.equal(r.ok, true); assert.equal(s.board[13], 2); assert.equal(s.score, 20); assert.equal(s.board[2], 2);
  const c = g.create(9, 4); c.board = Array(36).fill(0); c.current = 1; c.goal = 99999; c.board[12] = 1; c.board[7] = 1; c.board[14] = 2; c.board[19] = 2;
  const chain = g.act(c, 'place', { index: 13 }); assert.equal(c.board[13], 3); assert.equal(c.score, 80); assert.ok(chain.events.some(e => e.type === 'burst')); assert.equal(c.board.filter(v => v).length, 1);
  const d = g.create(9, 4); d.board = Array(36).fill(0); d.current = 1; d.board[6] = 1; d.board[8] = 1; g.act(d, 'place', { index: 13 }); assert.equal(d.score, 0); assert.equal(d.board[13], 1);
});

test('town store swaps once per placement, rocks are fixed and hammers free filled space', () => {
  const g = games.tripletown, s = g.create(0, 8), original = s.current;
  assert.equal(g.act(s, 'store').ok, true); assert.equal(s.bank, original); assert.equal(g.act(s, 'store').ok, false);
  assert.equal(g.act(s, 'place', { index: 0 }).ok, false); assert.equal(g.act(s, 'place', { index: 12 }).ok, true); assert.equal(g.act(s, 'store').ok, true);
  assert.equal(g.act(s, 'hammer').ok, true); assert.equal(g.act(s, 'place', { index: 0 }).ok, false); assert.equal(s.hammers, 2);
  assert.equal(g.act(s, 'place', { index: 12 }).ok, true); assert.equal(s.board[12], 0); assert.equal(s.hammers, 1);
  const before = clone(s); g.act(s, 'pointercancel', { x: 300, y: 300 }); assert.deepEqual(s, before);
});

test('water conserves finite mass, cannot tunnel through stone, and can be rescued by digging while flowing', () => {
  const g = games.waterworks, s = g.create(6, 17), rocks = s.soil.map((v, i) => v === 2 ? i : -1).filter(i => i >= 0);
  g.act(s, 'water'); advance(g, s, 5); assert.equal(s.collected, 0); assert.equal(s.phase, 'playing');
  assert.equal(s.emitted, s.drops.length + s.collected + s.lost);
  g.act(s, 'dig', { path: g.solution(6) });
  for (let i = 0; i < 4000 && s.phase === 'playing'; i++) { g.step(s, 1 / 120); assert.equal(s.emitted, s.drops.length + s.collected + s.lost); if (i % 50 === 0) assert.equal(g.validate(s), true); }
  assert.equal(s.phase, 'won'); assert.ok(rocks.every(i => s.soil[i] === 2)); assert.equal(s.stars, 3);
  const cancel = g.create(0, 1), before = clone(cancel); g.act(cancel, 'pointercancel', { path: g.solution(0) }); assert.deepEqual(cancel, before);
});

test('water loses when the finite supply is routed away from the tank', () => {
  const g = games.waterworks, s = g.create(0, 1), x = 48 + 9.5 * 13;
  g.act(s, 'dig', { path: [{ x, y: 180 }, { x, y: 720 }] }); g.act(s, 'water'); advance(g, s, 30);
  assert.equal(s.phase, 'lost'); assert.equal(s.collected, 0); assert.equal(g.validate(s), true);
});

test('parking solver verifies increasing optimal move counts and legal constrained motion', () => {
  const g = games.trafficpark;
  for (let level = 0; level < 10; level++) { const s = g.create(level, 7), solution = g.solve(s); assert.equal(solution.length, level + 1); for (const move of solution) { const before = clone(s); assert.equal(g.act(s, 'slide', move).ok, true); const car = s.cars[move.id]; assert.equal(car.axis === 'h' ? car.y : car.x, car.axis === 'h' ? before.cars[move.id].y : before.cars[move.id].x); assert.equal(g.validate(s), true); } assert.equal(s.phase, 'won'); }
  const s = g.create(9, 2), before = clone(s); assert.equal(g.act(s, 'slide', { id: 0, delta: 100 }).ok, false); assert.equal(s.cars[0].x, before.cars[0].x);
  const car = s.cars[2], p = g.center(car); g.act(s, 'pointerup', { start: p, x: p.x + 350, y: p.y }); assert.equal(car.x, before.cars[2].x); assert.equal(car.y, before.cars[2].y);
  g.act(s, 'slide', { id: 0, delta: -100 }); assert.equal(s.cars[0].x, 0);
  const old = clone(s); g.act(s, 'pointercancel', { x: 500, y: 500 }); assert.deepEqual(s, old);
});

test('mid-action JSON saves resume deterministically and reject corrupt dynamic fields', () => {
  for (const [id, g] of Object.entries(games)) {
    const s = g.create(3, 91), actions = plan(id, 3, 91); g.act(s, actions[0].type, actions[0].payload);
    if (id === 'waterworks') g.act(s, 'water'); advance(g, s, .15);
    const resumed = clone(s); assert.equal(g.validate(resumed), true);
    for (let i = 0; i < 120; i++) { g.step(s, 1 / 120); g.step(resumed, 1 / 120); } assert.deepEqual(resumed, s);
    for (const [field, value] of [['level', 22], ['rng', -1], ['moves', NaN], ['score', Infinity], ['stars', 4], ['phase', 'broken']]) { const broken = clone(s); broken[field] = value; assert.equal(g.validate(broken), false, `${id}.${field}`); }
  }
  const w = games.waterworks, s = w.create(0, 1); w.act(s, 'water'); advance(w, s, .2); const duplicate = clone(s); duplicate.drops.push(clone(duplicate.drops[0])); assert.equal(w.validate(duplicate), false);
  const stone = w.create(3, 1); stone.soil[stone.soil.indexOf(2)] = 0; assert.equal(w.validate(stone), false);
  const car = games.trafficpark.create(2, 1); car.cars[1].id = 0; assert.equal(games.trafficpark.validate(car), false);
  const overlap = games.trafficpark.create(2, 1); overlap.cars[1].y = 2; assert.equal(games.trafficpark.validate(overlap), false);
  const town = games.tripletown.create(2, 1); town.board[0] = 0; assert.equal(games.tripletown.validate(town), false);
});
