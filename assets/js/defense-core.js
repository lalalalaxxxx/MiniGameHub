(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const path = [...Array(8)].map((_, x) => x).concat(15, [...Array(8)].map((_, x) => 23 - x), 24, [...Array(8)].map((_, x) => 32 + x));
  const types = [
    { cost: 30, damage: 10, range: 2.6, delay: .8 },
    { cost: 45, damage: 8, range: 2.3, delay: 1.25, splash: true },
    { cost: 40, damage: 4, range: 2.8, delay: .9, slow: true }
  ];
  const point = cell => ({ x: cell % 8 + .5, y: Math.floor(cell / 8) + .5 });
  function position(s, e) {
    if (s.id === 'gardenwatch') return { x: 8.5 - e.p, y: e.lane + .5 };
    const n = Math.min(path.length - 1, Math.floor(e.p)), a = point(path[n]), b = point(path[Math.min(n + 1, path.length - 1)]), t = e.p - n;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  function buildable(id, cell) { return Number.isInteger(cell) && cell >= 0 && cell < 40 && (id === 'gardenwatch' ? cell % 8 < 6 : !path.includes(cell)); }
  function fresh(id, difficulty = 'easy') {
    return { version: 1, id, difficulty, coins: difficulty === 'easy' ? 210 : 180, hearts: difficulty === 'easy' ? 20 : 12, wave: 0, phase: 'ready', towers: [], enemies: [], projectiles: [], spawned: 0, spawnIn: 0, nextId: 1, cleared: 0 };
  }
  function build(s, cell, type) {
    if (!['ready', 'running'].includes(s.phase) || !buildable(s.id, cell) || !types[type] || s.towers.some(t => t.cell === cell) || s.coins < types[type].cost) return false;
    s.coins -= types[type].cost; s.towers.push({ cell, type, level: 1, cooldown: 0 }); return true;
  }
  function upgrade(s, cell) {
    const t = s.towers.find(t => t.cell === cell);
    if (!['ready', 'running'].includes(s.phase) || !t || t.level >= 3 || s.coins < 25 * t.level) return false;
    s.coins -= 25 * t.level; t.level++; return true;
  }
  function sell(s, cell) {
    const t = s.towers.find(t => t.cell === cell);
    if (!['ready', 'running'].includes(s.phase) || !t) return false;
    s.coins += Math.floor((types[t.type].cost + (t.level === 3 ? 75 : t.level === 2 ? 25 : 0)) * .8);
    s.towers = s.towers.filter(v => v !== t); return true;
  }
  const count = s => 5 + s.wave * 2;
  function start(s) {
    if (s.phase !== 'ready' || s.wave >= 6) return false;
    s.wave++; s.phase = 'running'; s.spawned = 0; s.spawnIn = 0; return true;
  }
  function tick(s, dt) {
    const events = [];
    if (s.phase !== 'running' || !Number.isFinite(dt) || dt <= 0) return events;
    dt = Math.min(dt, .1);
    s.spawnIn = Math.max(0, s.spawnIn - dt);
    if (s.spawned < count(s) && s.spawnIn <= 0) {
      const hp = (16 + s.wave * 5) * (s.difficulty === 'easy' ? 1 : 1.3);
      s.enemies.push({ id: s.nextId++, p: 0, lane: (s.spawned + s.wave - 1) % 5, hp, max: hp, slow: 0 });
      s.spawned++; s.spawnIn = 1.35;
    }
    for (const e of s.enemies) { e.p += dt * (s.id === 'gardenwatch' ? .48 : .92) * (s.difficulty === 'easy' ? 1 : 1.15) * (e.slow > 0 ? .45 : 1); e.slow = Math.max(0, e.slow - dt); }
    for (const t of s.towers) {
      t.cooldown = Math.max(0, t.cooldown - dt);
      if (t.cooldown > 0) continue;
      const spec = types[t.type], origin = point(t.cell);
      const candidates = s.enemies.filter(e => {
        if (e.hp <= 0) return false;
        const at = position(s, e);
        return s.id === 'gardenwatch' ? e.lane === Math.floor(t.cell / 8) && at.x >= origin.x - .15 && at.x - origin.x <= 7 : Math.hypot(at.x - origin.x, at.y - origin.y) <= spec.range + (t.level - 1) * .2;
      }).sort((a, b) => b.p - a.p);
      if (!candidates.length) continue;
      const target = candidates[0], at = position(s, target);
      s.projectiles.push({ x: origin.x, y: origin.y, target: target.id, tx: at.x, ty: at.y, type: t.type, damage: spec.damage * (1 + (t.level - 1) * .7), life: 3 });
      t.cooldown = spec.delay; events.push({ kind: 'shot', cell: t.cell, type: t.type, x: origin.x, y: origin.y, tx: at.x, ty: at.y });
    }
    s.projectiles = s.projectiles.filter(p => {
      const target = s.enemies.find(e => e.id === p.target && e.hp > 0);
      if (target) { const at = position(s, target); p.tx = at.x; p.ty = at.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, distance = Math.hypot(dx, dy), travel = dt * 7;
      p.life -= dt;
      if (distance > travel + .12 && p.life > 0) { p.x += dx / distance * travel; p.y += dy / distance * travel; return true; }
      if (distance <= travel + .12) {
        for (const e of s.enemies) {
          const at = position(s, e);
          if (e === target || (types[p.type].splash && Math.hypot(at.x - p.tx, at.y - p.ty) < 1.5)) {
            e.hp -= p.damage; if (types[p.type].slow) e.slow = 2;
            events.push({ kind: 'hurt', id: e.id });
          }
        }
        events.push({ kind: 'impact', x: p.tx, y: p.ty, type: p.type });
      }
      return false;
    });
    for (const e of s.enemies) {
      if (e.hp <= 0) { s.coins += 7; s.cleared++; events.push({ kind: 'clear', ...position(s, e) }); }
      else if (e.p >= (s.id === 'gardenwatch' ? 8.5 : path.length - 1)) { s.hearts = Math.max(0, s.hearts - 1); events.push({ kind: 'leak' }); }
    }
    s.enemies = s.enemies.filter(e => e.hp > 0 && e.p < (s.id === 'gardenwatch' ? 8.5 : path.length - 1));
    if (!s.hearts) { s.phase = 'lost'; s.projectiles = []; events.push({ kind: 'lost' }); }
    else if (s.spawned >= count(s) && !s.enemies.length && !s.projectiles.length) { s.coins += 35; s.phase = s.wave === 6 ? 'won' : 'ready'; events.push({ kind: s.phase === 'won' ? 'won' : 'wave' }); }
    return events;
  }
  const int = (n, a, b) => Number.isInteger(n) && n >= a && n <= b;
  const num = (n, a, b) => Number.isFinite(n) && n >= a && n <= b;
  function restore(id, raw) {
    const fallback = () => fresh(id);
    if (!raw || raw.version !== 1 || raw.id !== id || !['easy', 'normal'].includes(raw.difficulty) || !['ready', 'running', 'won', 'lost'].includes(raw.phase)) return fallback();
    if (!int(raw.coins, 0, 100000) || !int(raw.hearts, 0, 20) || !int(raw.wave, 0, 6) || !int(raw.spawned, 0, 17) || !num(raw.spawnIn, 0, 2) || !int(raw.nextId, 1, 1000) || !int(raw.cleared, 0, 1000)) return fallback();
    if (!Array.isArray(raw.towers) || raw.towers.length > 30 || !Array.isArray(raw.enemies) || raw.enemies.length > 17) return fallback();
    if (raw.towers.some(t => !t || !buildable(id, t.cell) || !int(t.type, 0, 2) || !int(t.level, 1, 3) || !num(t.cooldown, 0, 2)) || new Set(raw.towers.map(t => t.cell)).size !== raw.towers.length) return fallback();
    if (raw.enemies.some(e => !e || !int(e.id, 1, 999) || !num(e.p, 0, id === 'gardenwatch' ? 8.5 : path.length - 1) || !int(e.lane, 0, 4) || !num(e.max, 1, 100) || !num(e.hp, .00001, e.max) || !num(e.slow, 0, 2)) || new Set(raw.enemies.map(e => e.id)).size !== raw.enemies.length) return fallback();
    if ((raw.phase === 'running' && (!raw.wave || !raw.hearts)) || (raw.phase === 'won' && raw.wave !== 6) || (raw.phase === 'lost' && raw.hearts !== 0) || (raw.phase === 'ready' && (raw.enemies.length || raw.wave >= 6))) return fallback();
    const shots = raw.projectiles ?? [];
    if (!Array.isArray(shots) || shots.length > 200 || shots.some(p => !p || !num(p.x, 0, 9) || !num(p.y, 0, 5) || !num(p.tx, 0, 9) || !num(p.ty, 0, 5) || !int(p.target, 1, 999) || !int(p.type, 0, 2) || !num(p.damage, 1, 30) || !num(p.life, 0, 3))) return fallback();
    return { ...clone(raw), projectiles: clone(shots) };
  }
  const api = { clone, path, types, point, position, buildable, fresh, build, upgrade, sell, start, count, tick, restore };
  if (typeof module !== 'undefined') module.exports = api; else root.DefenseCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
