(function (root) {
  'use strict';
  const ID = 'waterworks', COLS = 48, ROWS = 44, CELL = 13, X = 48, Y = 148;
  const terrainCache = new WeakMap();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const at = (x, y) => y * COLS + x;
  const point = (x, y) => ({ x: X + (x + .5) * CELL, y: Y + (y + .5) * CELL });
  function rand(s) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }
  const LEVELS = [
    { source: 9, tank: 32, route: [[9, 5], [17, 18], [26, 31], [32, 42]], rocks: [] },
    { source: 37, tank: 12, route: [[37, 5], [29, 17], [19, 29], [12, 42]], rocks: [[0, 17, 22, 3]] },
    { source: 8, tank: 34, route: [[8, 5], [15, 16], [34, 26], [34, 42]], rocks: [[0, 21, 25, 3]] },
    { source: 36, tank: 11, route: [[36, 5], [33, 17], [11, 29], [11, 42]], rocks: [[18, 25, 30, 3]] },
    { source: 10, tank: 32, route: [[10, 5], [34, 18], [34, 26], [32, 42]], rocks: [[0, 22, 27, 3], [37, 10, 6, 21]] },
    { source: 37, tank: 13, route: [[37, 5], [13, 18], [13, 27], [13, 42]], rocks: [[20, 23, 28, 3], [4, 10, 6, 19]] },
    { source: 8, tank: 31, route: [[8, 5], [33, 17], [33, 23], [14, 27], [14, 34], [31, 42]], rocks: [[0, 20, 26, 3], [21, 30, 27, 2]] },
    { source: 38, tank: 15, route: [[38, 5], [14, 17], [14, 23], [34, 27], [34, 34], [15, 42]], rocks: [[21, 20, 27, 3], [0, 30, 27, 2]] },
    { source: 9, tank: 32, route: [[9, 5], [34, 17], [34, 23], [12, 27], [12, 34], [32, 42]], rocks: [[0, 20, 27, 2], [20, 30, 28, 2], [4, 34, 5, 6]] },
    { source: 38, tank: 14, route: [[38, 5], [13, 17], [13, 23], [35, 27], [35, 34], [14, 42]], rocks: [[20, 20, 28, 2], [0, 30, 27, 2], [39, 34, 5, 6]] }
  ];
  function create(level = 0, seed = 1) {
    level = clamp(Math.floor(level), 0, 9); seed >>>= 0; const cfg = LEVELS[level];
    const soil = Array(COLS * ROWS).fill(1);
    for (let y = 0; y < 8; y++) for (let x = 0; x < COLS; x++) soil[at(x, y)] = 0;
    for (const [rx, ry, rw, rh] of cfg.rocks) for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) soil[at(x, y)] = 2;
    for (let y = 40; y < ROWS; y++) for (let x = cfg.tank - 4; x <= cfg.tank + 4; x++) soil[at(x, y)] = 0;
    const route = cfg.route, ducks = [];
    for (let i = 1; i <= 3; i++) { const f = i / 4 * (route.length - 1), a = route[Math.floor(f)], b = route[Math.min(route.length - 1, Math.floor(f) + 1)], u = f % 1; ducks.push({ x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, got: false }); }
    return { v: 1, id: ID, level, seed, rng: seed, phase: 'playing', score: 0, stars: 0, moves: 0, t: 0, waterTime: 0, acc: 0, soil, drops: [], nextId: 1, emitted: 0, collected: 0, lost: 0, total: 120 + level * 6, goal: Math.ceil((120 + level * 6) * .63), source: cfg.source, tank: cfg.tank, open: false, begun: false, ducks, dug: 0 };
  }
  function digPoint(s, px, py) {
    const cx = (px - X) / CELL - .5, cy = (py - Y) / CELL - .5; let count = 0;
    for (let y = Math.max(8, Math.floor(cy - 2)); y <= Math.min(ROWS - 1, Math.ceil(cy + 2)); y++) for (let x = Math.max(0, Math.floor(cx - 2)); x <= Math.min(COLS - 1, Math.ceil(cx + 2)); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= 3.7 && s.soil[at(x, y)] === 1) { s.soil[at(x, y)] = 0; count++; }
    return count;
  }
  function act(s, type, p = {}) {
    if (s.phase !== 'playing') return { ok: false, events: [] };
    if (type === 'water') { s.open = !s.open; s.begun = true; s.moves++; return { ok: true, events: [{ type: 'drop', ...point(s.source, 3), color: '#65d2ff', count: 8 }] }; }
    if (type !== 'pointerup' && type !== 'dig') return { ok: false, events: [] };
    const path = Array.isArray(p.path) && p.path.length ? p.path.slice(0, 600) : [p.start || p, p];
    if (!path.every(q => q && Number.isFinite(q.x) && Number.isFinite(q.y) && Math.abs(q.x) <= 3000 && Math.abs(q.y) <= 3000)) return { ok: false, events: [] };
    let removed = 0;
    for (let i = 0; i < path.length; i++) { const a = path[Math.max(0, i - 1)], b = path[i], steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5)); for (let j = 0; j <= steps; j++) removed += digPoint(s, a.x + (b.x - a.x) * j / steps, a.y + (b.y - a.y) * j / steps); }
    if (!removed) return { ok: false, events: [] }; s.moves++; s.dug += removed; const last = path[path.length - 1];
    return { ok: true, events: [{ type: 'move', x: clamp(last.x, X, X + 624), y: clamp(last.y, Y, Y + 572), color: '#cba27a', count: Math.min(12, Math.ceil(removed / 8)) }] };
  }
  function flow(s) {
    const events = [], occupied = new Set(s.drops.map(d => at(d.x, d.y)));
    const free = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS && !s.soil[at(x, y)] && !occupied.has(at(x, y));
    if (s.open && s.emitted < s.total) {
      for (let i = 0; i < 3 && s.emitted < s.total; i++) { const x = s.source + Math.floor(rand(s) * 5) - 2, y = 2 + i; if (free(x, y)) { const d = { id: s.nextId++, x, y, px: x, py: y, dir: rand(s) < .5 ? -1 : 1 }; s.drops.push(d); occupied.add(at(x, y)); s.emitted++; } }
    }
    s.drops.sort((a, b) => b.y - a.y || a.id - b.id);
    const alive = [];
    for (const d of s.drops) {
      occupied.delete(at(d.x, d.y)); d.px = d.x; d.py = d.y;
      if (d.y >= ROWS - 1) {
        if (Math.abs(d.x - s.tank) <= 4) { s.collected++; s.score += 10; if (s.collected % 8 === 0) events.push({ type: 'collect', ...point(s.tank, 43), color: '#6bdaff', count: 4 }); } else s.lost++;
        continue;
      }
      if (free(d.x, d.y + 1)) d.y++;
      else if (free(d.x + d.dir, d.y + 1)) { d.x += d.dir; d.y++; }
      else if (free(d.x - d.dir, d.y + 1)) { d.x -= d.dir; d.y++; d.dir *= -1; }
      else if (free(d.x + d.dir, d.y)) d.x += d.dir;
      else if (free(d.x - d.dir, d.y)) { d.dir *= -1; d.x += d.dir; }
      occupied.add(at(d.x, d.y)); alive.push(d);
      for (const duck of s.ducks) if (!duck.got && Math.hypot(d.x - duck.x, d.y - duck.y) < 3.5) { duck.got = true; s.score += 100; events.push({ type: 'collect', ...point(duck.x, duck.y), color: '#ffdc66', count: 16 }); }
    }
    s.drops = alive;
    if (s.collected >= s.goal) { s.phase = 'won'; s.open = false; s.stars = Math.max(1, s.ducks.filter(d => d.got).length); events.push({ type: 'burst', ...point(s.tank, 42), color: '#8cefff', count: 20 }); }
    else if (s.emitted === s.total && s.collected + s.drops.length < s.goal) { s.phase = 'lost'; s.open = false; }
    return events;
  }
  function step(s, dt) { if (s.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return []; dt = Math.min(dt, .1); s.t += dt; if (!s.begun) return []; s.waterTime += dt; s.acc += dt; const events = []; while (s.acc >= .045 && s.phase === 'playing') { s.acc -= .045; events.push(...flow(s)); } if (s.phase !== 'playing') s.acc = 0; return events; }
  function solution(level) { return LEVELS[level].route.map(p => point(...p)); }
  function hint(s) { return { text: s.begun ? '水会往低处流；挖开积水下方，绕过灰色岩石，再接到蓝色水箱。' : '先画出一条不断向下的通道，再点「开水」。灰色岩石不能挖。', targets: solution(s.level) }; }
  function round(c, x, y, w, h, r, fill) { c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
  function paintSoil(c, s) {
    for (let y = 8; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const kind = s.soil[at(x, y)]; if (!kind) continue; c.fillStyle = kind === 2 ? ((x + y) % 3 ? '#819397' : '#9ba9ac') : ((x * 13 + y * 7) % 11 < 3 ? '#c49a6e' : '#b98c62'); c.fillRect(X + x * CELL, Y + y * CELL, CELL + .2, CELL + .2); if (kind === 2 && x % 3 === 0 && y % 2 === 0) { c.strokeStyle = '#b2bfc0'; c.lineWidth = 1; c.beginPath(); c.moveTo(X + x * CELL + 2, Y + y * CELL + 3); c.lineTo(X + x * CELL + 10, Y + y * CELL + 7); c.stroke(); } }
    c.strokeStyle = '#759b53'; c.lineWidth = 8; c.beginPath(); for (let x = 0; x < COLS; x++) if (s.soil[at(x, 8)]) { c.moveTo(X + x * CELL, Y + 8 * CELL); c.lineTo(X + (x + 1) * CELL, Y + 8 * CELL); } c.stroke();
  }
  function drawSoil(c, s) {
    const doc = c.canvas && c.canvas.ownerDocument;
    if (!doc) { paintSoil(c, s); return; }
    let cache = terrainCache.get(s);
    if (!cache || cache.dug !== s.dug) { const canvas = cache ? cache.canvas : doc.createElement('canvas'); canvas.width = 720; canvas.height = 800; const cc = canvas.getContext('2d'); paintSoil(cc, s); cache = { dug: s.dug, canvas }; terrainCache.set(s, cache); }
    c.drawImage(cache.canvas, 0, 0);
  }
  function drawDuck(c, x, y, got, t) { c.save(); c.translate(x, y + Math.sin(t * 3) * 2); c.fillStyle = got ? '#fff3a8' : '#ffd75b'; c.beginPath(); c.ellipse(0, 5, 19, 13, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(10, -8, 11, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ff994a'; c.beginPath(); c.moveTo(18, -10); c.lineTo(30, -6); c.lineTo(18, -3); c.fill(); c.fillStyle = '#4b402a'; c.beginPath(); c.arc(13, -11, 2, 0, Math.PI * 2); c.fill(); if (got) { c.fillStyle = '#fff'; c.font = 'bold 18px sans-serif'; c.fillText('✓', -8, 11); } c.restore(); }
  function draw(c, s, view = {}) {
    const time = view.reduced ? 0 : view.time || s.t;
    c.fillStyle = '#e8f7fc'; c.fillRect(0, 0, 720, 800);
    round(c, 28, 20, 664, 106, 25, '#fff'); c.fillStyle = '#246882'; c.font = 'bold 24px sans-serif'; c.textAlign = 'left'; c.fillText('挖开泥土，让清水流进水箱', 51, 56);
    c.font = '18px sans-serif'; c.fillStyle = '#65848c'; c.fillText(`剩余水滴 ${s.total - s.emitted}     已收集 ${s.collected} / ${s.goal}`, 52, 93);
    const sx = point(s.source, 0).x; round(c, sx - 46, Y - 13, 92, 95, 15, '#78c5df'); round(c, sx - 36, Y - 7, 72, 78, 10, '#9ae7ff');
    round(c, X - 6, Y + 7 * CELL, 636, ROWS * CELL - 7 * CELL + 8, 16, '#8e674e');
    drawSoil(c, s);
    const tx = point(s.tank, 0).x, ty = Y + ROWS * CELL;
    round(c, tx - 63, ty - 12, 126, 65, 15, '#72b6d1'); round(c, tx - 51, ty - 8, 102, 48, 9, '#e2faff');
    const fill = Math.min(1, s.collected / s.goal); round(c, tx - 48, ty + 37 - fill * 43, 96, Math.max(3, fill * 43), 5, '#48bbeb'); c.fillStyle = '#31758d'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.fillText('清水水箱', tx, ty + 58);
    for (const duck of s.ducks) { const p = point(duck.x, duck.y); drawDuck(c, p.x, p.y, duck.got, time); }
    const alpha = view.reduced ? 1 : clamp(s.acc / .045, 0, 1);
    c.fillStyle = '#5cd0ff'; c.strokeStyle = '#b3edff'; c.lineWidth = 1;
    c.beginPath(); for (const d of s.drops) { const p = point(d.px + (d.x - d.px) * alpha, d.py + (d.y - d.py) * alpha); c.moveTo(p.x + 5.5, p.y); c.arc(p.x, p.y, 5.5, 0, Math.PI * 2); } c.fill(); c.stroke();
    if (view.pointer && view.pointer.path) { c.save(); c.strokeStyle = '#fff5caaa'; c.lineWidth = 45; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); view.pointer.path.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke(); c.restore(); }
    c.fillStyle = '#fff'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText(s.open ? '流动中' : s.begun ? '已关水' : '准备开水', sx, Y + 31);
  }
  function hud(s) { return { scoreLabel: '清水积分', score: s.score, statLabel: '小鸭子', stat: `${s.ducks.filter(d => d.got).length} / 3`, goal: `引导 ${s.goal} 滴清水到水箱`, progress: Math.min(1, s.collected / s.goal), message: s.begun ? '继续挖通积水下方，水滴会绕着坡道流。' : '先挖通道再开水；一次划过可挖出弯曲路线。' }; }
  function controls(s) { return [{ id: 'water', label: s.open ? '关水' : s.begun ? '继续开水' : '开水', active: s.open, disabled: s.emitted >= s.total }]; }
  function validate(s) {
    const nat = (v, max) => Number.isInteger(v) && v >= 0 && v <= max, finite = (v, max) => Number.isFinite(v) && v >= 0 && v <= max;
    if (!s || s.v !== 1 || s.id !== ID || !nat(s.level, 9) || !['playing', 'won', 'lost'].includes(s.phase) || !nat(s.seed, 4294967295) || !nat(s.rng, 4294967295) || !nat(s.score, 1000000) || !nat(s.moves, 100000) || !nat(s.stars, 3) || !finite(s.t, 1000000) || !finite(s.waterTime, 1000000) || !finite(s.acc, .046)) return false;
    const fresh = create(s.level, s.seed); if (s.total !== fresh.total || s.goal !== fresh.goal || s.source !== fresh.source || s.tank !== fresh.tank || typeof s.open !== 'boolean' || typeof s.begun !== 'boolean') return false;
    if (!Array.isArray(s.soil) || s.soil.length !== COLS * ROWS || !s.soil.every((v, i) => [0, 1, 2].includes(v) && (fresh.soil[i] === 2 ? v === 2 : v !== 2) && !(fresh.soil[i] === 0 && v !== 0))) return false;
    if (!Array.isArray(s.drops) || s.drops.length > s.total || !nat(s.emitted, s.total) || !nat(s.collected, s.total) || !nat(s.lost, s.total) || s.collected + s.lost + s.drops.length !== s.emitted || s.nextId !== s.emitted + 1 || !nat(s.dug, COLS * ROWS)) return false;
    if (s.dug !== s.soil.reduce((n, v, i) => n + (fresh.soil[i] === 1 && v === 0 ? 1 : 0), 0) || s.waterTime > s.t + .00001 || (!s.begun && (s.emitted || s.open || s.waterTime))) return false;
    const ids = new Set(), cells = new Set(); for (const d of s.drops) { if (!d || !nat(d.id, s.emitted) || !d.id || ids.has(d.id) || !nat(d.x, COLS - 1) || !nat(d.y, ROWS - 1) || !nat(d.px, COLS - 1) || !nat(d.py, ROWS - 1) || Math.abs(d.px - d.x) > 1 || d.y < d.py || d.y - d.py > 1 || ![-1, 1].includes(d.dir) || s.soil[at(d.x, d.y)] || cells.has(at(d.x, d.y))) return false; ids.add(d.id); cells.add(at(d.x, d.y)); }
    if (!Array.isArray(s.ducks) || s.ducks.length !== 3 || !s.ducks.every((d, i) => d && d.x === fresh.ducks[i].x && d.y === fresh.ducks[i].y && typeof d.got === 'boolean')) return false;
    const duckCount = s.ducks.filter(d => d.got).length;
    if (s.score !== s.collected * 10 + duckCount * 100) return false;
    if (s.phase === 'won' && (s.collected < s.goal || s.stars !== Math.max(1, duckCount) || s.open)) return false;
    if (s.phase !== 'won' && (s.stars !== 0 || s.collected >= s.goal)) return false;
    if (s.phase === 'lost' && (s.emitted !== s.total || s.collected + s.drops.length >= s.goal || s.open)) return false;
    return true;
  }
  const G = { id: ID, meta: { title: '引水小工匠', category: '解谜', blurb: '挖出弯弯水道，让清水绕过岩石找到小鸭子。', tags: ['物理', '画线', '解谜'], color: '#39a9d3', instructions: '用手指划过泥土挖出水道，灰色岩石不能挖。准备好后点开水，水滴会受重力向下流；流动时也能继续挖。有限的清水达到水箱目标即可过关，顺路找到三只小鸭子可以获得三星。' }, levels: 10, create, act, step, draw, hud, controls, hint, validate, solution };
  if (typeof module !== 'undefined' && module.exports) module.exports = G; else (root.ExtraGames || (root.ExtraGames = {}))[ID] = G;
})(typeof window !== 'undefined' ? window : globalThis);
