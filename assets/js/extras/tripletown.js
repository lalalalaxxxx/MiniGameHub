(function (root) {
  'use strict';
  const ID = 'tripletown', N = 6, X = 48, Y = 158, CELL = 104;
  const COLORS = ['#f0f4d7', '#84bc4e', '#439b57', '#277f60', '#e8aa6b', '#e98983', '#ad92d8', '#f4d46d'];
  const NAMES = ['空地', '小草', '灌木', '大树', '小屋', '别墅', '城堡', '彩虹宫殿'];
  const endingAt = new WeakMap();
  const GOALS = [140, 200, 280, 380, 500, 650, 820, 1050, 1300, 1600];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const copy = o => JSON.parse(JSON.stringify(o));
  function rand(s) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }
  function next(s) { const r = rand(s); return r < .68 ? 1 : r < .94 ? 2 : 3; }
  function neighbors(i) { const a = []; if (i % N) a.push(i - 1); if (i % N < N - 1) a.push(i + 1); if (i >= N) a.push(i - N); if (i < N * (N - 1)) a.push(i + N); return a; }
  function group(board, i) { const todo = [i], seen = new Set(todo), value = board[i]; for (let p = 0; p < todo.length; p++) for (const j of neighbors(todo[p])) if (board[j] === value && !seen.has(j)) { seen.add(j); todo.push(j); } return todo; }
  function pos(i) { return { x: X + (i % N + .5) * CELL, y: Y + (Math.floor(i / N) + .5) * CELL }; }
  function index(x, y) { const c = Math.floor((x - X) / CELL), r = Math.floor((y - Y) / CELL); return c >= 0 && c < N && r >= 0 && r < N ? r * N + c : -1; }
  function create(level = 0, seed = 1) {
    level = clamp(Math.floor(level), 0, 9); seed = seed >>> 0;
    const s = { v: 1, id: ID, level, seed, rng: seed, phase: 'playing', score: 0, stars: 0, moves: 0, t: 0, board: Array(36).fill(0), current: 1, queue: [], bank: 0, stored: false, hammers: 2, hammer: false, goal: GOALS[level], merges: 0, highest: 2, anims: [], last: -1 };
    const rocks = [[0, 35], [5, 30], [0, 5, 35], [0, 30, 35], [0, 5, 30, 35], [0, 5, 30, 35, 14], [0, 5, 30, 35, 21], [0, 5, 30, 35, 8], [0, 5, 30, 35, 9, 26], [0, 5, 30, 35, 8, 27]][level];
    for (const i of rocks) s.board[i] = -1;
    for (const [i, value] of [[18, 1], [19, 1], [24, 2], [25, 2], [3, 1], [9, 1]]) if (!s.board[i]) s.board[i] = value;
    s.queue = [1, 2, 1]; for (let i = 0; i < 3; i++) rand(s);
    return s;
  }
  function advance(s) { s.current = s.queue.shift(); s.queue.push(next(s)); s.stored = false; }
  function place(s, i) {
    if (i < 0 || i >= 36 || s.board[i]) return { ok: false, events: [] };
    const events = [], p = pos(i); s.board[i] = s.current; s.moves++; s.last = i;
    events.push({ type: 'drop', ...p, color: COLORS[s.current], count: 4 });
    let chain = 0;
    while (s.board[i] < 7) {
      const g = group(s.board, i); if (g.length < 3) break;
      const value = s.board[i]; for (const j of g) { const q = pos(j); s.anims.push({ x: q.x, y: q.y, value, t: 0, tx: p.x, ty: p.y }); s.board[j] = 0; }
      s.board[i] = value + 1; s.score += Math.round(20 * Math.pow(3, value - 1) * (g.length - 2)); s.merges++; chain++;
      s.highest = Math.max(s.highest, value + 1);
      events.push({ type: chain > 1 ? 'burst' : 'merge', ...p, color: COLORS[value + 1], count: Math.min(22, 8 + g.length * 2) });
    }
    s.anims = s.anims.slice(-30); advance(s);
    if (s.score >= s.goal) { s.phase = 'won'; s.stars = s.moves <= 30 + s.level * 5 ? 3 : s.moves <= 50 + s.level * 6 ? 2 : 1; }
    else if (!s.board.includes(0) && !s.hammers) s.phase = 'lost';
    return { ok: true, events };
  }
  function act(s, type, p = {}) {
    if (s.phase !== 'playing') return { ok: false, events: [] };
    if (type === 'pointerup' && p.x >= 548 && p.x <= 649 && p.y >= 28 && p.y <= 133) return act(s, 'store');
    if (type === 'store') {
      if (s.stored || s.hammer) return { ok: false, events: [] };
      const held = s.bank; s.bank = s.current; if (held) s.current = held; else advance(s);
      s.stored = true; s.moves++; return { ok: true, events: [{ type: 'move', x: 606, y: 77, color: '#fff', count: 3 }] };
    }
    if (type === 'hammer') { if (!s.hammers) return { ok: false, events: [] }; s.hammer = !s.hammer; return { ok: true, events: [] }; }
    if (type !== 'pointerup' && type !== 'place') return { ok: false, events: [] };
    const i = type === 'place' ? p.index : index(p.x, p.y);
    if (!Number.isInteger(i) || i < 0 || i >= 36) return { ok: false, events: [] };
    if (s.hammer) { if (s.board[i] <= 0 || !s.hammers) return { ok: false, events: [] }; s.board[i] = 0; s.hammers--; s.hammer = false; s.moves++; return { ok: true, events: [{ type: 'clear', ...pos(i), color: '#ffe2a3', count: 12 }] }; }
    return place(s, i);
  }
  function step(s, dt) { if (s.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return []; s.t += Math.min(dt, .1); for (const a of s.anims) a.t += dt; s.anims = s.anims.filter(a => a.t < .32); return []; }
  function inspectPlacement(s, i) { const t = copy(s); t.anims = []; const before = t.score; place(t, i); const near = neighbors(i).filter(j => t.board[j] === t.current).length; return { state: t, gain: t.score - before, value: (t.score - before) * 8 + t.board.filter(v => v === 0).length * 6 + near * 3 }; }
  function best(s) {
    let choice = null;
    for (let i = 0; i < 36; i++) if (!s.board[i]) {
      const v = inspectPlacement(s, i); let future = 0;
      if (v.state.phase === 'playing') for (let j = 0; j < 36; j++) if (!v.state.board[j]) future = Math.max(future, inspectPlacement(v.state, j).gain);
      const currentNeighbors = neighbors(i).filter(j => s.board[j] === s.current).length;
      const metric = v.value + future * 3 + currentNeighbors * 7 - Math.abs(i % 6 - 2.5) * .1;
      if (!choice || metric > choice.metric) choice = { index: i, metric, gain: v.gain };
    }
    return choice;
  }
  function hint(s) { const b = best(s); if (!b) return { text: s.hammers ? '点小锤子，再点一个建筑，腾出一格空间。' : '这一片已经满了，试试撤销上一步。' }; return { text: b.gain ? '试试这里！三个相同元素会合成，升级后还可能连锁。' : '把同样的元素放在相邻位置，给下一次合成留出空地。', targets: [pos(b.index)] }; }
  function rounded(c, x, y, w, h, r, fill) { c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
  function tile(c, value, x, y, scale, time) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    c.fillStyle = '#234d2a22'; c.beginPath(); c.ellipse(0, 26, 31, 10, 0, 0, Math.PI * 2); c.fill();
    if (value === -1) { c.fillStyle = '#81969c'; c.beginPath(); c.moveTo(-30, 20); c.lineTo(-22, -16); c.lineTo(-4, -27); c.lineTo(23, -15); c.lineTo(32, 22); c.closePath(); c.fill(); c.strokeStyle = '#b1c3c8'; c.lineWidth = 4; c.beginPath(); c.moveTo(-17, -8); c.lineTo(0, -17); c.lineTo(18, -6); c.stroke(); }
    else if (value === 1) { c.strokeStyle = '#4c983e'; c.lineWidth = 9; c.lineCap = 'round'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 10, 22); c.quadraticCurveTo(i * 17 + Math.sin(time * 2 + i) * 2, 1, i * 25, -14 + Math.abs(i) * 8); c.stroke(); } }
    else if (value === 2) { for (const [a, b, r] of [[-18, 5, 20], [17, 5, 21], [0, -10, 25]]) { c.fillStyle = COLORS[2]; c.beginPath(); c.arc(a, b, r, 0, Math.PI * 2); c.fill(); } c.fillStyle = '#fbd881'; for (const [a, b] of [[-12, 3], [13, 10], [3, -15]]) { c.beginPath(); c.arc(a, b, 4, 0, Math.PI * 2); c.fill(); } }
    else if (value === 3) { rounded(c, -6, 3, 12, 29, 4, '#956f4c'); c.fillStyle = COLORS[3]; c.beginPath(); c.moveTo(0, -37); c.lineTo(30, 12); c.lineTo(16, 12); c.lineTo(34, 25); c.lineTo(-34, 25); c.lineTo(-16, 12); c.lineTo(-30, 12); c.closePath(); c.fill(); c.fillStyle = '#6ebe79'; c.beginPath(); c.moveTo(0, -28); c.lineTo(13, -6); c.lineTo(-13, -6); c.fill(); }
    else { const wide = value >= 5 ? 62 : 49; rounded(c, -wide / 2, -6, wide, 37, 5, COLORS[value]); c.fillStyle = value >= 6 ? '#8062ae' : '#c96f56'; c.beginPath(); c.moveTo(-wide / 2 - 7, -5); c.lineTo(0, -36); c.lineTo(wide / 2 + 7, -5); c.closePath(); c.fill(); rounded(c, -7, 9, 14, 23, 4, '#72553d'); for (const a of [-19, 19]) rounded(c, a - 5, 2, 10, 11, 2, '#fff3a9'); if (value >= 6) { for (const a of [-31, 31]) { rounded(c, a - 9, -20, 18, 53, 4, '#c1a3e2'); c.fillStyle = '#8062ae'; c.beginPath(); c.moveTo(a - 13, -19); c.lineTo(a, -42); c.lineTo(a + 13, -19); c.fill(); } } if (value === 7) { c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffe885'; c.fillText('★', 0, -27); } }
    c.restore();
  }
  function draw(c, s, view = {}) {
    const time = view.reduced ? 0 : view.time || s.t;
    let endAge = 0; if (s.phase !== 'playing') { if (!endingAt.has(s) && view.dt) endingAt.set(s, view.time || 0); endAge = endingAt.has(s) ? Math.max(0, (view.time || 0) - endingAt.get(s)) : 1; }
    c.fillStyle = '#e7f3dd'; c.fillRect(0, 0, 720, 800);
    rounded(c, 24, 20, 672, 116, 25, '#ffffffd9');
    c.fillStyle = '#3d6044'; c.font = 'bold 20px sans-serif'; c.textAlign = 'left'; c.fillText('现在放置', 43, 49); tile(c, s.current, 99, 92, .7, time);
    c.fillStyle = '#6c836d'; c.font = '17px sans-serif'; c.fillText('接下来', 190, 49); s.queue.forEach((v, i) => tile(c, v, 217 + i * 79, 91, .55, time));
    c.textAlign = 'center'; c.fillText('暂存格', 596, 49); rounded(c, 556, 58, 82, 68, 14, '#e7eddc'); if (s.bank) tile(c, s.bank, 597, 91, .65, time); else { c.fillStyle = '#9eaf95'; c.font = '28px sans-serif'; c.fillText('+', 596, 102); }
    rounded(c, X - 7, Y - 7, CELL * 6 + 14, CELL * 6 + 14, 24, '#b4cda7');
    for (let i = 0; i < 36; i++) { const p = pos(i); rounded(c, p.x - 48, p.y - 48, 96, 96, 15, (Math.floor(i / 6) + i % 6) % 2 ? '#d7e8c5' : '#e0edce'); if (s.board[i]) tile(c, s.board[i], p.x, p.y + 4, .98, time); }
    if (view.pointer) { const i = index(view.pointer.target.x, view.pointer.target.y); if (i >= 0 && (!s.board[i] || s.hammer)) { const p = pos(i); c.save(); c.globalAlpha = .55; tile(c, s.hammer ? -1 : s.current, p.x, p.y, 1.06, time); c.restore(); c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.strokeRect(p.x - 48, p.y - 48, 96, 96); } }
    if (!view.reduced) for (const a of s.anims) { const f = Math.min(1, (a.t + endAge) / .32), k = 1 - f; if (!k) continue; c.save(); c.globalAlpha = k; tile(c, a.value, a.x + (a.tx - a.x) * f, a.y + (a.ty - a.y) * f - Math.sin(f * Math.PI) * 28, k, time); c.restore(); }
  }
  function hud(s) { return { scoreLabel: '小镇积分', score: s.score, statLabel: '已放置', stat: s.moves, goal: `达到 ${s.goal} 分 · 最高建成${NAMES[s.highest]}`, progress: Math.min(1, s.score / s.goal), message: s.hammer ? '点击要移走的建筑。岩石不能敲掉。' : `现在是${NAMES[s.current]}，三个相邻即可升级。` }; }
  function controls(s) { return [{ id: 'store', label: s.bank ? '交换暂存' : '暂存一个', disabled: s.stored || s.hammer }, { id: 'hammer', label: `小锤子 ${s.hammers}`, disabled: !s.hammers, active: s.hammer }]; }
  function validate(s) {
    if (!s || s.v !== 1 || s.id !== ID || !Number.isInteger(s.level) || s.level < 0 || s.level > 9 || !['playing', 'won', 'lost'].includes(s.phase)) return false;
    const nat = (v, max) => Number.isInteger(v) && v >= 0 && v <= max, finite = (v, max) => Number.isFinite(v) && v >= 0 && v <= max;
    if (!nat(s.seed, 4294967295) || !nat(s.rng, 4294967295) || !nat(s.moves, 100000) || !nat(s.score, 100000000) || !nat(s.stars, 3) || !finite(s.t, 1000000) || s.goal !== GOALS[s.level]) return false;
    if (!Array.isArray(s.board) || s.board.length !== 36 || !s.board.every(v => Number.isInteger(v) && v >= -1 && v <= 7)) return false;
    const original = create(s.level, s.seed); if (!s.board.every((v, i) => (v === -1) === (original.board[i] === -1))) return false;
    if (!Array.isArray(s.queue) || s.queue.length !== 3 || !s.queue.every(v => nat(v, 3) && v >= 1) || !nat(s.current, 3) || s.current < 1 || !nat(s.bank, 3) || !nat(s.hammers, 2) || typeof s.stored !== 'boolean' || typeof s.hammer !== 'boolean') return false;
    if ((s.stored && !s.bank) || (s.hammer && !s.hammers)) return false;
    if (!nat(s.merges, 100000) || !nat(s.highest, 7) || s.highest < 1 || !Number.isInteger(s.last) || s.last < -1 || s.last > 35 || !Array.isArray(s.anims) || s.anims.length > 30) return false;
    if (!s.anims.every(a => a && finite(a.x, 720) && finite(a.y, 800) && finite(a.tx, 720) && finite(a.ty, 800) && finite(a.t, .33) && nat(a.value, 7) && a.value >= 1)) return false;
    if (s.phase === 'won' && (s.score < s.goal || !s.stars)) return false;
    if (s.phase !== 'won' && (s.stars !== 0 || s.score >= s.goal)) return false;
    if (s.phase === 'lost' && (s.board.includes(0) || s.hammers)) return false;
    if (s.highest < Math.max(...s.board)) return false;
    return true;
  }
  const G = { id: ID, meta: { title: '合成小镇', category: '策略', blurb: '三棵小草变灌木，连锁建起童话小镇。', tags: ['合成', '空间规划', '策略'], color: '#559967', instructions: '点击空格放置预览元素。三个或更多同级元素上下左右连在一起，就会在落点升级；新建筑还能继续连锁。暂存格可以交换当前元素，小锤子可腾出两格。达到目标积分即可过关。' }, levels: 10, create, act, step, draw, hud, controls, hint, validate, best, names: NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = G; else (root.ExtraGames || (root.ExtraGames = {}))[ID] = G;
})(typeof window !== 'undefined' ? window : globalThis);
