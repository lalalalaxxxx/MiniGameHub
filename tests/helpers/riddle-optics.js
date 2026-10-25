'use strict';
const games = { mirrorlight: require('../../assets/js/extras/mirrorlight.js'), firefly: require('../../assets/js/extras/firefly.js') };
function plan(id, level, seed = 37) {
  const game = games[id]; if (!game) throw new Error(`Unknown game: ${id}`);
  const state = game.create(level, seed), solution = game.solve(state); if (!solution) throw new Error(`${id} ${level}: no solution`);
  const actions = [];
  for (const move of solution) { const point = game.center(state, move.index); actions.push({ type: 'tap', point }); const result = game.act(state, 'pointerup', { ...point, start: point }); if (!result.ok) throw new Error(`${id} ${level}: illegal UI move`); for (let i = 0; i < 90 && game.needsFrame(state); i++) game.step(state, 1 / 120); }
  if (state.phase !== 'won') throw new Error(`${id} ${level}: UI solution did not win`);
  return actions;
}
module.exports = { games, plan, solve: (id, state) => games[id].solve(state) };
