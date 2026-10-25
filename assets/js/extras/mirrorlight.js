(function (root) {
  'use strict';
  const ID = 'mirrorlight', X = 60, Y = 150, CELL = 120, N = 5;
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1], REFLECT = [[3, 2, 1, 0], [1, 0, 3, 2]];
  // Authored compact boards. A prism transmits straight ahead and reflects a
  // second ray. Targets do not stop light, so every jar must be lit together.
  const MAPS = [
    { source: [0,3,0], mirrors: [18], prisms: [], targets: [3], walls: [], start: 1 },
    { source: [0,3,0], mirrors: [18,8], prisms: [], targets: [5], walls: [12], start: 1 },
    { source: [0,4,0], mirrors: [24,4,1], prisms: [], targets: [16], walls: [12,18], start: 5 },
    { source: [0,4,0], mirrors: [24,4,1,11], prisms: [], targets: [13], walls: [8,17], start: 5 },
    { source: [0,3,0], mirrors: [19,7], prisms: [[17,0]], targets: [4,5], walls: [11], start: 1 },
    { source: [0,3,0], mirrors: [19,7,4,5], prisms: [[17,0]], targets: [3,20], walls: [13], start: 9 },
    { source: [0,2,0], mirrors: [2,5,6,12], prisms: [[0,0]], targets: [11,21,1], walls: [4,8], start: 8 },
    { source: [0,2,0], mirrors: [7,22,17,12,20], prisms: [[9,1],[5,0]], targets: [11,6,16], walls: [24,23], start: 10 },
    { source: [0,2,0], mirrors: [5,3,1,22,21,6], prisms: [[11,1],[13,0]], targets: [0,2,8,17], walls: [20,18], start: 44 },
    { source: [0,2,0], mirrors: [18,19,22,13,24,7,5], prisms: [[8,1],[12,0]], targets: [17,0,23,6], walls: [4,1], start: 16 }
  ];
  for (const m of MAPS) { for (const k of ['source','mirrors','targets','walls']) Object.freeze(m[k]); m.prisms.forEach(Object.freeze); Object.freeze(m.prisms); Object.freeze(m); } Object.freeze(MAPS);
  const caches = new WeakMap(), endings = new WeakMap(), solved = new Map();
  const pop = n => { let total = 0; for (; n; n &= n - 1) total++; return total; };
  const point = cell => ({ x: X + (cell % N + .5) * CELL, y: Y + (Math.floor(cell / N) + .5) * CELL });
  function trace(layout, bits) {
    const queue = [{ x: layout.source[0], y: layout.source[1], d: layout.source[2], depth: 1 }], seen = new Set(), lit = new Set(), segments = [], reached = new Set(), graph = new Map(); let loops = 0;
    for (let h = 0; h < queue.length; h++) {
      const node = queue[h], { x, y, d } = node, cell = y * N + x, key = cell * 4 + d;
      if (seen.has(key)) continue; seen.add(key); reached.add(cell); graph.set(key, []);
      if (layout.targets.includes(cell)) lit.add(cell);
      const index = layout.mirrors.indexOf(cell), prism = layout.prisms.find(p => p[0] === cell);
      const next = index >= 0 ? [REFLECT[(bits >> index) & 1][d]] : prism ? [d, REFLECT[prism[1]][d]] : [d];
      for (const nd of next) {
        const xx = x + DX[nd], yy = y + DY[nd], outside = xx < 0 || xx >= N || yy < 0 || yy >= N, wall = layout.walls.includes(yy * N + xx), a = point(cell), b = point(yy * N + xx);
        // Compute the endpoint geometrically; point(-1) wraps rows in JS.
        b.x = a.x + DX[nd] * CELL * (outside || wall ? .5 : 1); b.y = a.y + DY[nd] * CELL * (outside || wall ? .5 : 1);
        segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, depth: node.depth });
        if (!outside && !wall) { graph.get(key).push((yy * N + xx) * 4 + nd); queue.push({ x: xx, y: yy, d: nd, depth: node.depth + 1 }); }
      }
    }
    // A second ray can merge into an earlier branch without forming a loop.
    // A gray DFS edge detects real cycles, including cycles between branches.
    const colors = new Map(); function visit(key) { if (colors.get(key) === 1) { loops++; return; } if (colors.get(key) === 2) return; colors.set(key,1); for (const next of graph.get(key) || []) visit(next); colors.set(key,2); } for (const key of graph.keys()) visit(key);
    return { lit: [...lit], segments, reached: [...reached], loops, won: lit.size === layout.targets.length };
  }
  function light(s) { let cached = caches.get(s); if (!cached || cached.bits !== s.bits) { cached = { bits: s.bits, value: trace(MAPS[s.level], s.bits) }; caches.set(s, cached); } return cached.value; }
  function solutions(level) { if (!solved.has(level)) { const m = MAPS[level], list = []; for (let b = 0; b < 1 << m.mirrors.length; b++) if (trace(m, b).won) list.push(b); solved.set(level, list); } return solved.get(level); }
  function solve(s) { const choices = solutions(s.level); if (!choices.length) return null; let best = choices[0]; for (const b of choices) if (pop(b ^ s.bits) < pop(best ^ s.bits)) best = b; return MAPS[s.level].mirrors.map((_, index) => ({ type: 'rotate', index })).filter(a => (best ^ s.bits) & 1 << a.index); }
  function create(level = 0, seed = 1) { level = Number.isFinite(level) ? Math.max(0, Math.min(9, Math.floor(level))) : 0; seed >>>= 0; const s = { v: 1, id: ID, level, seed, rng: seed, phase: 'playing', score: 0, stars: 0, moves: 0, t: 0, bits: MAPS[level].start, selected: 0, par: 0, pulse: 0, anims: [] }; s.par = solve(s).length; return s; }
  function center(s, index) { return point(MAPS[s.level].mirrors[index]); }
  const angle = b => b ? Math.PI / 4 : -Math.PI / 4;
  const ease = t => 1 - Math.pow(1 - Math.min(1, t / .28), 3);
  function rotate(s, index) {
    if (!Number.isInteger(index) || index < 0 || index >= MAPS[s.level].mirrors.length) return { ok: false, events: [] };
    const old = s.anims.find(a => a.index === index), before = angle((s.bits >> index) & 1), from = old ? old.from + (before - old.from) * ease(old.t) : before, wasLit = light(s).lit;
    s.bits ^= 1 << index; s.selected = index; s.moves++; s.pulse = .65; s.anims = s.anims.filter(a => a.index !== index); s.anims.push({ index, from, t: 0 });
    const p = center(s, index), now = light(s), events = [{ type: 'rotate', ...p, color: '#b5e8eb' }];
    for (const cell of now.lit) if (!wasLit.includes(cell)) events.push({ type: 'collect', ...point(cell), color: '#ffeaa1', count: 7 });
    if (now.won) { s.phase = 'won'; s.stars = s.moves <= s.par + 2 ? 3 : s.moves <= s.par * 2 + 3 ? 2 : 1; s.score = Math.max(100, 1000 + s.level * 100 - Math.max(0, s.moves - s.par) * 25); }
    return { ok: true, events };
  }
  function under(s, p) { if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return -1; const x = Math.floor((p.x - X) / CELL), y = Math.floor((p.y - Y) / CELL); return x < 0 || y < 0 || x >= N || y >= N ? -1 : MAPS[s.level].mirrors.indexOf(y * N + x); }
  function act(s, type, p = {}) {
    if (s.phase !== 'playing') return { ok: false, events: [] };
    if (type === 'rotate') return rotate(s, p.index === undefined ? s.selected : p.index);
    if (type === 'pointerup') { const from = p.start || p; if (!Number.isFinite(from.x) || !Number.isFinite(from.y) || Math.hypot(p.x - from.x, p.y - from.y) > 24 || under(s, from) !== under(s, p)) return { ok: false, events: [] }; return rotate(s, under(s, p)); }
    if (type === 'left' || type === 'right') { s.selected = (s.selected + (type === 'left' ? -1 : 1) + MAPS[s.level].mirrors.length) % MAPS[s.level].mirrors.length; return { ok: true, events: [] }; }
    return { ok: false, events: [] };
  }
  function step(s, dt) { if (s.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return []; dt = Math.min(.1, dt); s.t += dt; s.pulse = Math.max(0, s.pulse - dt); for (const a of s.anims) a.t += dt; s.anims = s.anims.filter(a => a.t < .28); return []; }
  function hint(s) { const next = solve(s)?.[0]; return next ? { text: `旋转第 ${next.index + 1} 面镜子，让光线继续走向星星罐。蓝色水晶会把光分成两路。`, targets: [center(s, next.index)], move: next } : { text: '每个星星罐都接到光啦！', targets: [] }; }
  function rr(c, x, y, w, h, r, fill) { c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
  function star(c, x, y, r, fill) { c.fillStyle = fill; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, d = i % 2 ? r * .46 : r; i ? c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) : c.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.closePath(); c.fill(); }
  function background(c, level) {
    const m = MAPS[level], g = c.createLinearGradient(0, 0, 720, 800); g.addColorStop(0, '#192e4d'); g.addColorStop(1, '#28534e'); c.fillStyle = g; c.fillRect(0, 0, 720, 800);
    for (let i = 0; i < 28; i++) { c.fillStyle = i % 3 ? '#dcecdf4a' : '#fcecb88a'; c.beginPath(); c.arc((i * 137 + 31) % 720, (i * 61 + 19) % 800, i % 3 + 1, 0, 7); c.fill(); }
    rr(c, 35, 28, 650, 95, 26, '#0d243d90'); c.fillStyle = '#fff2c3'; c.font = 'bold 29px sans-serif'; c.textAlign = 'left'; c.fillText('让每一颗星星接到光', 60, 68); c.fillStyle = '#bbd9d4'; c.font = '19px sans-serif'; c.fillText(m.prisms.length ? '点镜子转方向 · 蓝色水晶会分出两路光' : '点一下镜子 · 观察光线拐弯的方向', 60, 102);
    rr(c, X - 14, Y - 14, 628, 628, 28, '#142c34'); rr(c, X - 6, Y - 6, 612, 612, 22, '#476d69');
    for (let i = 0; i < 25; i++) { const p = point(i); rr(c, p.x - 58, p.y - 58, 116, 116, 14, (Math.floor(i / 5) + i % 5) % 2 ? '#264951' : '#2b5057'); c.fillStyle = '#a3c8b825'; c.beginPath(); c.arc(p.x, p.y, 3, 0, 7); c.fill(); }
    for (const cell of m.walls) { const p = point(cell); rr(c, p.x - 46, p.y - 38, 92, 84, 19, '#132e38'); rr(c, p.x - 46, p.y - 46, 92, 80, 19, '#66817d'); rr(c, p.x - 40, p.y - 40, 80, 21, 9, '#88a08a'); c.strokeStyle = '#3f6366'; c.lineWidth = 4; c.beginPath(); c.moveTo(p.x - 41, p.y); c.lineTo(p.x + 41, p.y); c.moveTo(p.x - 9, p.y - 16); c.lineTo(p.x - 9, p.y); c.moveTo(p.x + 13, p.y); c.lineTo(p.x + 13, p.y + 29); c.stroke(); }
    c.fillStyle = '#aac9be'; c.font = '17px sans-serif'; c.textAlign = 'center'; c.fillText('银色镜子可旋转 · 石墙会挡住光线', 360, 788);
  }
  function draw(c, s, view = {}) {
    let endAge = 0; if (s.phase !== 'playing') { if (!endings.has(s) && view.dt) endings.set(s, view.time || 0); endAge = endings.has(s) ? Math.max(0, (view.time || 0) - endings.get(s)) : 1; }
    const m = MAPS[s.level], ray = light(s), pulse = view.reduced ? 0 : Math.max(0, s.pulse - endAge);
    if (!root.ExtraRender?.layer(c, `${ID}-${s.level}`, layer => background(layer, s.level))) background(c, s.level);
    c.lineCap = 'round';
    for (const [width, color] of [[24,'#ffdb5c0c'],[12,'#ffdc6626'],[5,'#ffdd71'],[2,'#fff6c6']]) { c.lineWidth = width; c.strokeStyle = color; c.beginPath(); for (const r of ray.segments) { c.moveTo(r.x1, r.y1); c.lineTo(r.x2, r.y2); } c.stroke(); }
    if (pulse > 0) { const progress = (1 - pulse / .65) * 25; for (const r of ray.segments) if (Math.abs(r.depth - progress) < 1.6) { const f = Math.max(0, Math.min(1, progress - r.depth + 1)); star(c, r.x1 + (r.x2 - r.x1) * f, r.y1 + (r.y2 - r.y1) * f, 7, '#fff9d8'); } }
    for (const [cell, orientation] of m.prisms) { const p = point(cell); c.save(); c.translate(p.x, p.y); c.fillStyle = '#98e7ec'; c.beginPath(); c.moveTo(0,-37); c.lineTo(32,-7); c.lineTo(23,31); c.lineTo(-23,31); c.lineTo(-32,-7); c.closePath(); c.fill(); c.strokeStyle = '#e9ffff'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#49b7cb'; c.beginPath(); c.moveTo(0,-37); c.lineTo(0,31); c.lineTo(23,31); c.lineTo(32,-7); c.closePath(); c.fill(); c.strokeStyle = '#efffff'; c.lineWidth = 5; c.beginPath(); c.moveTo(-17, orientation ? -17 : 17); c.lineTo(17, orientation ? 17 : -17); c.stroke(); c.restore(); }
    m.mirrors.forEach((cell, i) => { const p = point(cell), a = s.anims.find(a => a.index === i), target = angle((s.bits >> i) & 1), theta = a && !view.reduced ? a.from + (target - a.from) * ease(a.t + endAge) : target; c.save(); c.translate(p.x, p.y); c.fillStyle = '#132d3e'; c.beginPath(); c.arc(0,7,44,0,7); c.fill(); c.fillStyle = '#547b87'; c.beginPath(); c.arc(0,0,42,0,7); c.fill(); if (s.selected === i) { c.strokeStyle = '#fff3ac'; c.lineWidth = 4; c.beginPath(); c.arc(0,0,48,0,7); c.stroke(); } c.rotate(theta); rr(c,-47,-9,94,18,8,'#d8f4f5'); rr(c,-43,-7,86,5,2,'#fff'); rr(c,-43,4,86,4,2,'#7aadc1'); c.restore(); c.fillStyle = '#cde5e3'; c.font = 'bold 17px sans-serif'; c.textAlign = 'center'; c.fillText(i + 1,p.x,p.y + 55); });
    for (const cell of m.targets) { const p = point(cell), on = ray.lit.includes(cell), bloom = on ? pulse / .65 : 0; if (on) { c.fillStyle = '#ffdf7920'; c.beginPath(); c.arc(p.x,p.y,48 + bloom * 5,0,7); c.fill(); } rr(c,p.x - 32,p.y - 31,64,70,17,on ? '#fce3a72e' : '#193447'); c.strokeStyle = on ? '#ffe8a4' : '#8eafb8'; c.lineWidth = 3; c.beginPath(); c.roundRect(p.x-32,p.y-31,64,70,17); c.stroke(); rr(c,p.x-25,p.y-39,50,11,4,on ? '#f4d184' : '#70949d'); star(c,p.x,p.y + 1,24 + bloom * 4,on ? '#ffe99c' : '#668b9b'); if (on) { c.fillStyle = '#ae7c3d'; c.beginPath(); c.arc(p.x-6,p.y,2,0,7); c.arc(p.x+6,p.y,2,0,7); c.fill(); } }
    const source = point(m.source[1] * N + m.source[0]); c.save(); c.translate(source.x,source.y); c.rotate(m.source[2]*Math.PI/2); rr(c,-37,-31,65,62,17,'#9c783d'); rr(c,-32,-26,53,50,12,'#f2cc72'); rr(c,-23,-19,34,38,9,'#fff2b0'); c.fillStyle='#ffe69b'; c.beginPath(); c.moveTo(29,-13); c.lineTo(45,0); c.lineTo(29,13); c.fill(); c.restore();
  }
  function hud(s) { const lit = light(s).lit.length; return { scoreLabel: '星星罐', score: `${lit} / ${MAPS[s.level].targets.length}`, statLabel: '旋转次数', stat: s.moves, goal: '同时点亮所有星星罐', progress: lit / MAPS[s.level].targets.length, message: s.level < 4 ? '点镜子旋转，也可以用下方按钮选择和旋转。' : '蓝色水晶固定不动：一束直行，一束反射。' }; }
  function controls(s) { return [{ id: 'left', label: '上一面镜子' }, { id: 'rotate', label: `旋转 ${s.selected + 1} 号镜子` }, { id: 'right', label: '下一面镜子' }]; }
  function validate(s) {
    const nat = (v, max) => Number.isInteger(v) && v >= 0 && v <= max, finite = (v, max) => Number.isFinite(v) && v >= 0 && v <= max;
    if (!s || s.v !== 1 || s.id !== ID || !nat(s.level,9) || !nat(s.seed,4294967295) || s.rng !== s.seed || !['playing','won'].includes(s.phase) || !nat(s.moves,10000000) || !finite(s.t,10000000) || !finite(s.pulse,.65)) return false;
    const m = MAPS[s.level]; if (!nat(s.bits,(1 << m.mirrors.length)-1) || !nat(s.selected,m.mirrors.length-1) || s.par !== create(s.level,s.seed).par || !Array.isArray(s.anims) || s.anims.length > m.mirrors.length) return false;
    const distance = pop(s.bits ^ m.start); if (distance > s.moves || (distance & 1) !== (s.moves & 1) || (!s.moves && (s.anims.length || s.pulse))) return false;
    if (s.anims.some(a => !a || !nat(a.index,m.mirrors.length-1) || !Number.isFinite(a.from) || Math.abs(a.from)>Math.PI/4+.00001 || !finite(a.t,.28)) || new Set(s.anims.map(a=>a.index)).size !== s.anims.length) return false;
    const won = trace(m,s.bits).won; if ((s.phase==='won') !== won) return false;
    if (!won) return s.stars === 0 && s.score === 0;
    return s.moves > 0 && s.stars === (s.moves <= s.par+2 ? 3 : s.moves <= s.par*2+3 ? 2 : 1) && s.score === Math.max(100,1000+s.level*100-Math.max(0,s.moves-s.par)*25);
  }
  const G = { id: ID, meta: { title: '星光镜子屋', category: '解谜', blurb: '转动银色镜子，把温柔的光送进每一个星星罐。', tags: ['观察','光线','空间思维'], color: '#79bac3', instructions: ['点击银色镜子旋转，让光线同时照到所有星星罐。','石墙会挡光；蓝色水晶固定不动，会把光分成直行和反射两路。','下方大按钮也能选择和旋转镜子；提示会标出下一面要旋转的镜子。'] }, levels: 10, create, act, step, draw, hud, controls, hint, validate, solve, center, trace, layouts: MAPS, needsFrame: s => s.phase === 'playing' && (s.pulse > 0 || s.anims.length > 0) };
  (root.ExtraGames || (root.ExtraGames = {}))[ID] = G; if (typeof module !== 'undefined' && module.exports) module.exports = G;
})(typeof globalThis !== 'undefined' ? globalThis : this);
