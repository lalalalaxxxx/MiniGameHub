'use strict';
const games = Object.fromEntries(['tripletown', 'waterworks', 'trafficpark'].map(id => [id, require(`../../assets/js/extras/${id}.js`)]));
function point(index) { return { x: 48 + (index % 6 + .5) * 104, y: 158 + (Math.floor(index / 6) + .5) * 104 }; }
// All returned gestures are legal public input; no board mutation or forced win.
function plan(id, level = 0, seed = 37) {
  const g = games[id], s = g.create(level, seed), actions = [];
  if (id === 'waterworks') return [{ type: 'pointerup', payload: { path: g.solution(level), start: g.solution(level)[0], ...g.solution(level).at(-1) } }, { type: 'water', payload: {} }, { wait: 20 }];
  if (id === 'trafficpark') {
    for (const move of g.solve(s)) { const c = s.cars[move.id], start = g.center(c), end = { x: start.x + (c.axis === 'h' ? move.delta * 100 : 0), y: start.y + (c.axis === 'v' ? move.delta * 100 : 0) }; actions.push({ type: 'pointerup', payload: { ...end, start, path: [start, end] } }); g.act(s, 'slide', move); }
    return actions;
  }
  for (let i = 0; i < 160 && s.phase === 'playing'; i++) {
    const best = g.best(s);
    if (!best) { actions.push({ type: 'hammer', payload: {} }); g.act(s, 'hammer'); const index = s.board.findIndex(v => v === 1), p = point(index < 0 ? s.board.findIndex(v => v > 0) : index); actions.push({ type: 'pointerup', payload: { ...p, start: p, path: [p] } }); g.act(s, 'pointerup', p); }
    else { const p = point(best.index); actions.push({ type: 'pointerup', payload: { ...p, start: p, path: [p] } }); g.act(s, 'pointerup', p); }
  }
  if (s.phase !== 'won') throw new Error(`${id} level ${level} has no planned win`);
  return actions;
}
module.exports = { games, plan, point };
