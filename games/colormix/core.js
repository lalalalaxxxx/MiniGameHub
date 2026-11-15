/* A small, deliberately simplified paint model: RYB recipes, never additive RGB. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ColorMix = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const colors = {
    red: { name: '红色', hex: '#ef6377', mark: '●', friend: '小狐狸' },
    yellow: { name: '黄色', hex: '#f5cd52', mark: '★', friend: '小蜜蜂' },
    blue: { name: '蓝色', hex: '#579de0', mark: '◆', friend: '小鲸鱼' },
    orange: { name: '橙色', hex: '#f49a4b', mark: '♥', friend: '小猫咪' },
    green: { name: '绿色', hex: '#66b886', mark: '▲', friend: '小青蛙' },
    purple: { name: '紫色', hex: '#a080cc', mark: '☾', friend: '小怪兽' },
    brown: { name: '棕色', hex: '#a77b60', mark: '■', friend: '小棕熊' },
    white: { name: '白色', hex: '#fffaf0', mark: '☁', friend: '小云朵' },
    'light-red': { name: '粉色', hex: '#f7afba', mark: '●', friend: '小兔子' },
    'light-blue': { name: '浅蓝色', hex: '#adcef0', mark: '◆', friend: '小海豚' },
    'light-purple': { name: '浅紫色', hex: '#c0abdd', mark: '☾', friend: '小精灵' },
    'light-yellow': { name: '浅黄色', hex: '#fae5a0', mark: '★', friend: '小鸡仔' },
    'light-orange': { name: '浅橙色', hex: '#f9c99d', mark: '♥', friend: '小松鼠' },
    'light-green': { name: '浅绿色', hex: '#b4dbc0', mark: '▲', friend: '小乌龟' },
    'light-brown': { name: '浅棕色', hex: '#d4bbae', mark: '■', friend: '小刺猬' },
  };
  const recipes = { red: ['red'], yellow: ['yellow'], blue: ['blue'], orange: ['red', 'yellow'], green: ['yellow', 'blue'], purple: ['blue', 'red'], brown: ['red', 'yellow', 'blue'], white: ['white'] };
  const modes = {
    shop: { name: '小熊颜料店', icon: '🎨', short: '接订单', count: 9 },
    town: { name: '彩虹小镇', icon: '🏡', short: '修复小镇', count: 3 },
    detective: { name: '颜色侦探', icon: '🔍', short: '猜配方', count: 12 },
    lab: { name: '魔法实验室', icon: '🧪', short: '自由探索', count: 0 },
    shades: { name: '深浅变变变', icon: '☁', short: '加点白色', count: 9 },
  };
  const primaries = ['red', 'yellow', 'blue'];
  const secondaries = ['orange', 'green', 'purple'];
  const objects = ['balloon', 'car', 'flower'];
  const objectNames = { balloon: '气球', car: '小汽车', flower: '花朵', tree: '大树', house: '小屋', windmill: '风车' };
  const townObjects = ['tree', 'house', 'flower', 'windmill', 'car', 'balloon'];
  const townColors = [['green', 'orange', 'purple', 'orange', 'green', 'purple'], ['purple', 'green', 'orange', 'purple', 'orange', 'green'], ['orange', 'purple', 'green', 'green', 'purple', 'orange']];
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  function mix(drops) {
    if (!Array.isArray(drops) || !drops.length || drops.some(c => ![...primaries, 'white'].includes(c))) return null;
    const pigments = [...new Set(drops.filter(c => c !== 'white'))];
    const base = pigments.length === 3 ? 'brown' : pigments.length === 2 ? secondaries.find(c => recipes[c].every(x => pigments.includes(x))) : pigments[0] || 'white';
    const white = drops.filter(c => c === 'white').length;
    const id = white && base !== 'white' ? 'light-' + base : base;
    // White lightens an already selected paint hue; it does not determine the hue.
    const t = base === 'white' ? 0 : white / drops.length;
    const rgb = colors[base].hex.slice(1).match(/../g).map(x => parseInt(x, 16));
    const hex = '#' + rgb.map(v => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('');
    return { id, base, name: colors[id].name, hex, white, mark: colors[id].mark };
  }
  function createRound(mode, level = 0) {
    const r = { level, drops: [], mixed: false, won: false, painted: [], patch: 0 };
    if (mode === 'detective' && level < 6) r.drops = [recipes[secondaries[level % 3]][Math.floor(level / 3)]];
    if (mode === 'shades') r.drops = [...recipes[['red', 'blue', 'purple'][Math.floor(level / 3)]]];
    return r;
  }
  function fresh() {
    return { version: 1, mode: 'shop', sound: true, book: {}, rounds: Object.fromEntries(Object.keys(modes).map(m => [m, createRound(m)])) };
  }
  function task(state) {
    const m = state.mode, r = state.rounds[m], l = r.level;
    let color, object, drops, choices = primaries;
    if (m === 'lab') return { title: '今天，你会发现什么颜色？', choices: [...primaries, 'white'], limit: 8, object: 'friend' };
    if (m === 'shop') { color = secondaries[l % 3]; object = objects[Math.floor(l / 3)]; }
    if (m === 'town') { color = townColors[l][r.patch]; object = townObjects[r.patch]; }
    if (m === 'detective') {
      color = secondaries[l % 3]; object = 'mystery';
      if (l < 3) choices = [recipes[color][1], primaries.find(c => !recipes[color].includes(c))].sort();
    }
    if (m === 'shades') {
      drops = [...recipes[['red', 'blue', 'purple'][Math.floor(l / 3)]], ...Array(l % 3 + 1).fill('white')];
      color = mix(drops).id; object = objects[Math.floor(l / 3)]; choices = ['white'];
    }
    drops ||= [...recipes[color]];
    const result = mix(drops);
    return { color, object, drops, target: result, choices, limit: m === 'shades' ? recipes[result.base].length + 3 : 2,
      title: m === 'detective' ? (l < 6 ? '少了哪一种颜色？' : '选哪两种颜色，才能找到它？') : m === 'shades' ? `调出这样的${result.name}` : `给${objectNames[object]}穿上${colors[color].name}` };
  }
  function minimum(state) { return createRound(state.mode, state.rounds[state.mode].level).drops.length; }
  function add(state, color) {
    const r = state.rounds[state.mode], t = task(state);
    if (r.won || !t.choices.includes(color) || r.drops.length >= t.limit) return false;
    r.drops.push(color); r.mixed = false; return true;
  }
  function undo(state) {
    const r = state.rounds[state.mode];
    if (r.won || r.drops.length <= minimum(state)) return false;
    r.drops.pop(); r.mixed = false; return true;
  }
  function reset(state) {
    const r = state.rounds[state.mode];
    if (r.won) return false;
    r.drops = createRound(state.mode, r.level).drops; r.mixed = false; return true;
  }
  function stir(state) {
    const r = state.rounds[state.mode];
    if (r.won || !r.drops.length) return null;
    if (state.mode !== 'lab' && r.drops.length <= minimum(state)) return null;
    if (['shop', 'town', 'detective'].includes(state.mode) && r.drops.length !== 2) return null;
    r.mixed = true;
    const result = mix(r.drops), discovered = !own(state.book, result.id);
    if (discovered) state.book[result.id] = [...r.drops];
    return { ...result, discovered };
  }
  function matches(state) {
    const r = state.rounds[state.mode], t = task(state), result = mix(r.drops);
    return !!(r.mixed && result && t.target && result.hex === t.target.hex);
  }
  function apply(state) {
    const r = state.rounds[state.mode];
    if (r.won || !matches(state)) return false;
    if (state.mode === 'town') {
      if (r.painted.includes(r.patch)) return false;
      r.painted.push(r.patch);
      r.won = r.painted.length === townObjects.length;
    } else r.won = true;
    return true;
  }
  function selectPatch(state, patch) {
    const r = state.rounds.town;
    if (state.mode !== 'town' || r.won || !Number.isInteger(patch) || patch < 0 || patch >= townObjects.length || r.painted.includes(patch)) return false;
    r.patch = patch; r.drops = []; r.mixed = false; return true;
  }
  function next(state) {
    const m = state.mode, r = state.rounds[m];
    if (m === 'lab' || !r.won || r.level >= modes[m].count - 1) return false;
    state.rounds[m] = createRound(m, r.level + 1); return true;
  }
  function restore(value) {
    const state = fresh();
    if (!value || value.version !== 1 || typeof value !== 'object') return state;
    if (own(modes, value.mode)) state.mode = value.mode;
    state.sound = value.sound !== false;
    for (const m of Object.keys(modes)) {
      const saved = value.rounds?.[m];
      if (!saved || !Number.isInteger(saved.level) || saved.level < 0 || saved.level >= Math.max(1, modes[m].count)) continue;
      const r = createRound(m, saved.level);
      state.rounds[m] = r;
      r.patch = Number.isInteger(saved.patch) && saved.patch >= 0 && saved.patch < 6 ? saved.patch : 0;
      r.painted = m === 'town' && Array.isArray(saved.painted) ? [...new Set(saved.painted.filter(x => Number.isInteger(x) && x >= 0 && x < 6))] : [];
      const view = { ...state, mode: m }, t = task(view), fixed = createRound(m, saved.level).drops;
      if (Array.isArray(saved.drops) && saved.drops.length <= t.limit && saved.drops.length >= fixed.length && saved.drops.every((c, i) => i < fixed.length ? c === fixed[i] : t.choices.includes(c))) r.drops = [...saved.drops];
      r.mixed = saved.mixed === true && (m === 'lab' ? r.drops.length > 0 : m === 'shades' ? r.drops.length > fixed.length : r.drops.length === 2);
      r.won = m === 'town' ? r.painted.length === 6 : m !== 'lab' && saved.won === true && matches(view);
    }
    if (value.book && typeof value.book === 'object') for (const id of Object.keys(colors)) {
      const drops = value.book[id];
      if (Array.isArray(drops) && drops.length <= 8 && mix(drops)?.id === id) state.book[id] = [...drops];
    }
    return state;
  }
  return { colors, recipes, modes, primaries, secondaries, objects, objectNames, townObjects, townColors, mix, fresh, createRound, task, minimum, add, undo, reset, stir, matches, apply, selectPatch, next, restore };
});
