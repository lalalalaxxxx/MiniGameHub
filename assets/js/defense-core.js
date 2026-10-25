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
  const pathPoints = path.map(point), workspaces = new WeakMap();
  function position(s, e, out = {}) {
    if (s.id === 'gardenwatch') { out.x = 8.5 - e.p; out.y = e.lane + .5; return out; }
    const n = Math.min(path.length - 1, Math.floor(e.p)), a = pathPoints[n], b = pathPoints[Math.min(n + 1, path.length - 1)], t = e.p - n;
    out.x = a.x + (b.x - a.x) * t; out.y = a.y + (b.y - a.y) * t; return out;
  }
  function buildable(id, cell) { return Number.isInteger(cell) && cell >= 0 && cell < 40 && (id === 'gardenwatch' ? cell % 8 < 6 : !path.includes(cell)); }
  function fresh(id, difficulty = 'normal') {
    return { version: 1, rules: 2, id, difficulty, coins: difficulty === 'easy' ? 210 : 180, hearts: difficulty === 'easy' ? 20 : difficulty === 'hard' ? 5 : 8, wave: 0, phase: 'ready', breakLeft: 0, towers: [], enemies: [], projectiles: [], spawned: 0, spawnIn: 0, nextId: 1, cleared: 0 };
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
  const advanced = s => s.rules === 2 && s.difficulty !== 'easy';
  const waves = s => advanced(s) ? s.difficulty === 'hard' ? 12 : 10 : 6;
  const count = s => advanced(s) ? 8 + s.wave * 3 + (s.difficulty === 'hard' ? 4 : 0) : 5 + s.wave * 2;
  const kinds = { plain: {hp:1,speed:1,leak:1}, runner:{hp:.7,speed:1.65,leak:1}, armor:{hp:1.5,speed:.82,leak:1}, swarm:{hp:.55,speed:1.15,leak:1}, boss:{hp:4,speed:.65,leak:3} };
  function waveKind(s) { return !advanced(s)||s.wave<2?'plain':s.wave%5===0||s.wave===waves(s)?'boss':['swarm','plain','runner','armor'][s.wave%4]; }
  function enemyKind(s,n) {const kind=waveKind(s);return kind==='boss'?(n===count(s)-1?'boss':n%4===0?'armor':n%3===0?'runner':'swarm'):n%4===3?'plain':kind;}
  function damage(s,p,e) {return p.damage * (advanced(s)&&e.kind==='armor'?(p.type===1?1.4:.45):1);}
  function start(s) {
    if (s.phase !== 'ready' || s.wave >= waves(s)) return false;
    s.wave++; s.phase = 'running'; s.breakLeft = 0; s.spawned = 0; s.spawnIn = 0; return true;
  }
  function tick(s, dt) {
    const events = [];
    if (!Number.isFinite(dt) || dt <= 0) return events;
    dt = Math.min(dt, .1);
    if (s.phase === 'ready' && s.wave > 0 && s.wave < waves(s)) {
      s.breakLeft = Math.max(0, (s.breakLeft ?? 10) - dt);
      if (s.breakLeft <= .000001 && start(s)) events.push({ kind: 'start' });
      return events;
    }
    if (s.phase !== 'running') return events;
    s.spawnIn = Math.max(0, s.spawnIn - dt);
    if (s.spawned < count(s) && s.spawnIn <= 0) {
      const kind=enemyKind(s,s.spawned),spec=kinds[kind];
      const hp = advanced(s)?(22+s.wave*9+s.wave*s.wave*.9)*spec.hp*(s.difficulty==='hard'?1.12:1):(16+s.wave*5)*(s.difficulty==='easy'?1:1.3);
      const lane=advanced(s)&&s.wave>=3?(Math.floor(s.spawned/3)+s.wave-1)%5:(s.spawned+s.wave-1)%5;
      s.enemies.push({ id: s.nextId++, kind, p: 0, lane, hp, max: hp, slow: 0 });
      s.spawned++; s.spawnIn = advanced(s)?Math.max(.28,1.05-s.wave*.055)*(kind==='swarm'?.48:1)*(s.difficulty==='hard'?.85:1):1.35-(s.wave-1)*.06;
    }
    for (const e of s.enemies) { e.p += dt * (advanced(s)?(s.id==='gardenwatch'?.48:1.15)*(1+s.wave*.035)*(kinds[e.kind]?.speed||1)*(s.difficulty==='hard'?1.06:1):(s.id==='gardenwatch'?.48:.92)*(s.difficulty==='easy'?1:1.15)) * (e.slow > 0 ? e.kind==='boss'?.7:.45 : 1); e.slow = Math.max(0, e.slow - dt); }
    // Reuse positions throughout this tick; combat never moves enemies during impact resolution.
    let work = workspaces.get(s);
    if (!work) { work = { byId: new Map(), positions: new WeakMap() }; workspaces.set(s, work); }
    work.byId.clear();
    for (const e of s.enemies) {
      let at = work.positions.get(e); if (!at) { at = {}; work.positions.set(e, at); }
      position(s, e, at); work.byId.set(e.id, e);
    }
    for (const t of s.towers) {
      t.cooldown = Math.max(0, t.cooldown - dt);
      if (t.cooldown > 0) continue;
      const spec = types[t.type], origin = point(t.cell);
      const range = spec.range + (t.level - 1) * .2;
      let target = null;
      for (const e of s.enemies) {
        if (e.hp <= 0 || target && e.p <= target.p) continue;
        const at = work.positions.get(e), dx = at.x - origin.x, dy = at.y - origin.y;
        if (s.id === 'gardenwatch' ? e.lane === Math.floor(t.cell / 8) && at.x >= origin.x - .15 && dx <= 7 : dx * dx + dy * dy <= range * range) target = e;
      }
      if (!target) continue;
      const at = work.positions.get(target);
      s.projectiles.push({ x: origin.x, y: origin.y, target: target.id, tx: at.x, ty: at.y, type: t.type, damage: spec.damage * (1 + (t.level - 1) * .7), life: 3 });
      t.cooldown = spec.delay; events.push({ kind: 'shot', cell: t.cell, type: t.type, x: origin.x, y: origin.y, tx: at.x, ty: at.y });
    }
    let liveShots = 0;
    for (const p of s.projectiles) {
      const found = work.byId.get(p.target), target = found && found.hp > 0 ? found : undefined;
      if (target) { const at = work.positions.get(target); p.tx = at.x; p.ty = at.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, distance = Math.hypot(dx, dy), travel = dt * 7;
      p.life -= dt;
      if (distance > travel + .12 && p.life > 0) { p.x += dx / distance * travel; p.y += dy / distance * travel; s.projectiles[liveShots++] = p; continue; }
      if (distance <= travel + .12) {
        if (types[p.type].splash) for (const e of s.enemies) {
          const at = work.positions.get(e), dx = at.x - p.tx, dy = at.y - p.ty;
          if (e === target || dx * dx + dy * dy < 2.25) {
            e.hp -= damage(s,p,e); if (types[p.type].slow) e.slow = 2;
            events.push({ kind: 'hurt', id: e.id });
          }
        } else if (target) { target.hp -= damage(s,p,target); if (types[p.type].slow) target.slow = 2; events.push({ kind: 'hurt', id: target.id }); }
        events.push({ kind: 'impact', x: p.tx, y: p.ty, type: p.type });
      }
    }
    s.projectiles.length = liveShots;
    for (const e of s.enemies) {
      if (e.hp <= 0) { const reward=advanced(s)?e.kind==='boss'?30:5:7;s.coins += reward; s.cleared++; events.push({ kind: 'clear', reward, ...position(s, e) }); }
      else if (e.p >= (s.id === 'gardenwatch' ? 8.5 : path.length - 1)) { s.hearts = Math.max(0, s.hearts - (kinds[e.kind]?.leak||1)); events.push({ kind: 'leak' }); }
    }
    s.enemies = s.enemies.filter(e => e.hp > 0 && e.p < (s.id === 'gardenwatch' ? 8.5 : path.length - 1));
    if (!s.hearts) { s.phase = 'lost'; s.projectiles = []; events.push({ kind: 'lost' }); }
    else if (s.spawned >= count(s) && !s.enemies.length && !s.projectiles.length) { s.coins += advanced(s)?25:35; s.phase = s.wave === waves(s) ? 'won' : 'ready'; s.breakLeft = s.phase === 'ready' ? 10 : 0; events.push({ kind: s.phase === 'won' ? 'won' : 'wave' }); }
    return events;
  }
  const int = (n, a, b) => Number.isInteger(n) && n >= a && n <= b;
  const num = (n, a, b) => Number.isFinite(n) && n >= a && n <= b;
  function restore(id, raw) {
    const fallback = () => fresh(id);
    if (!raw || raw.version !== 1 || raw.id !== id || !['easy', 'normal', 'hard'].includes(raw.difficulty) || !['ready', 'running', 'won', 'lost'].includes(raw.phase) || raw.rules!==undefined&&raw.rules!==2) return fallback();
    if (!int(raw.coins, 0, 100000) || !int(raw.hearts, 0, 20) || !int(raw.wave, 0, waves(raw)) || !int(raw.spawned, 0, count(raw)) || !num(raw.spawnIn, 0, 2) || !int(raw.nextId, 1, 1000) || !int(raw.cleared, 0, 1000)) return fallback();
    if (!Array.isArray(raw.towers) || raw.towers.length > 30 || !Array.isArray(raw.enemies) || raw.enemies.length > count(raw)) return fallback();
    if (raw.towers.some(t => !t || !buildable(id, t.cell) || !int(t.type, 0, 2) || !int(t.level, 1, 3) || !num(t.cooldown, 0, 2)) || new Set(raw.towers.map(t => t.cell)).size !== raw.towers.length) return fallback();
    if (raw.enemies.some(e => !e || e.kind!==undefined&&!Object.hasOwn(kinds,e.kind) || !int(e.id, 1, 999) || !num(e.p, 0, id === 'gardenwatch' ? 8.5 : path.length - 1) || !int(e.lane, 0, 4) || !num(e.max, 1, 2000) || !num(e.hp, .00001, e.max) || !num(e.slow, 0, 2)) || new Set(raw.enemies.map(e => e.id)).size !== raw.enemies.length) return fallback();
    if ((raw.phase === 'running' && (!raw.wave || !raw.hearts)) || (raw.phase === 'won' && raw.wave !== waves(raw)) || (raw.phase === 'lost' && raw.hearts !== 0) || (raw.phase === 'ready' && (raw.enemies.length || raw.wave >= waves(raw)))) return fallback();
    const shots = raw.projectiles ?? [];
    if (!Array.isArray(shots) || shots.length > 200 || shots.some(p => !p || !num(p.x, 0, 9) || !num(p.y, 0, 5) || !num(p.tx, 0, 9) || !num(p.ty, 0, 5) || !int(p.target, 1, 999) || !int(p.type, 0, 2) || !num(p.damage, 1, 30) || !num(p.life, 0, 3))) return fallback();
    if (raw.breakLeft !== undefined && !num(raw.breakLeft, 0, 10)) return fallback();
    return { ...clone(raw), breakLeft: raw.breakLeft ?? (raw.phase === 'ready' && raw.wave > 0 ? 10 : 0), projectiles: clone(shots) };
  }
  const api = { clone, path, types, point, position, buildable, fresh, build, upgrade, sell, start, count, waves, advanced, waveKind, enemyKind, damage, tick, restore };
  if (typeof module !== 'undefined') module.exports = api; else root.DefenseCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
