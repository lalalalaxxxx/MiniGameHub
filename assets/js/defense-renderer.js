/* Retained actors and one bounded particle canvas: no per-frame SVG rebuilding. */
window.createDefenseRenderer = function (svg, garden) {
  const C = DefenseCore, FX = DefenseFX, ns = 'http://www.w3.org/2000/svg';
  const enemies = new Map(), shots = new Map(), alive = new Set(), flying = new Set(), location = {};
  const spokes = Array.from({length: 6}, (_, i) => ({x: Math.cos(i * Math.PI / 3), y: Math.sin(i * Math.PI / 3)}));
  const canvas = document.createElement('canvas');
  canvas.className = 'battle-effects'; canvas.setAttribute('aria-hidden', 'true');
  canvas.width = 800; canvas.height = 500; svg.after(canvas);
  const ctx = canvas.getContext('2d');
  const range = document.createElementNS(ns, 'circle');
  range.setAttribute('fill', '#fff2'); range.setAttribute('stroke', '#5a7a6a66');
  range.setAttribute('stroke-width', '3'); range.setAttribute('stroke-dasharray', '8 8');
  svg.append(range);
  let towers = [], hadEffects = false;
  const colors = ['#a8d55c', '#ee9dcc', '#99e7fc'];
  const attr = (el, name, value) => { const next = String(value); if (el.getAttribute(name) !== next) el.setAttribute(name, next); };
  const group = markup => { const el = document.createElementNS(ns, 'g'); el.innerHTML = markup; svg.append(el); return el; };
  function circle(x, y, r, color, stroke) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function particles(fx, reduced) {
    if (!fx.bursts.length && !hadEffects) return;
    ctx.clearRect(0, 0, 800, 500); hadEffects = fx.bursts.length > 0;
    for (const b of fx.bursts) {
      const u = b.age / b.duration, x = b.x * 100, y = b.y * 100;
      const color = colors[b.type] || '#f1c85d';
      ctx.globalAlpha = 1 - u;
      if (b.kind === 'clear') {
        circle(x, y - u * 45, 12 + u * 8, '#f8dc73');
        ctx.fillStyle = '#795322'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`+${b.reward ?? 7}`, x, y - u * 45 + 5); continue;
      }
      if (reduced) { ctx.globalAlpha *= .5; circle(x, y, 14, color); continue; }
      const radius = b.kind === 'muzzle' ? 18 : b.type === 1 ? 72 : b.type === 2 ? 42 : 28;
      ctx.lineWidth = 5 * (1 - u); circle(x, y, radius * u, null, color);
      for (let i = 0; i < 6; i++) {
        const r = radius * (.25 + .75 * u);
        const px = x + spokes[i].x * r, py = y + spokes[i].y * r;
        ctx.lineWidth = b.type === 2 ? 3 : 2;
        if (b.type === 2) {
          ctx.beginPath(); ctx.moveTo(px - 5, py); ctx.lineTo(px + 5, py);
          ctx.moveTo(px, py - 5); ctx.lineTo(px, py + 5); ctx.strokeStyle = color; ctx.stroke();
        } else circle(px, py, (b.type === 1 ? 9 : 4) * (1 - u) + 1, color, b.type === 1 ? 'white' : null);
      }
    }
    ctx.globalAlpha = 1;
  }
  function draw(s, fx, selected, reduced) {
    for (const {el, cell} of towers) {
      const f = String(FX.frame(fx, cell, reduced));
      if (el.dataset.frame !== f) { el.dataset.frame = f; el.style.backgroundPosition = `${Number(f) * 100 / 9}% 0`; }
    }
    const t = s.towers.find(t => t.cell === selected);
    attr(range, 'display', t && !garden ? 'inline' : 'none');
    if (t && !garden) {
      const p = C.point(t.cell); attr(range, 'cx', p.x * 100); attr(range, 'cy', p.y * 100);
      attr(range, 'r', (C.types[t.type].range + (t.level - 1) * .2) * 100);
    }
    alive.clear(); for (const e of s.enemies) alive.add(e);
    for (const [e, node] of enemies) if (!alive.has(e)) { node.el.remove(); enemies.delete(e); }
    for (const e of s.enemies) {
      let node = enemies.get(e);
      if (!node) {
        const kind = e.kind || 'plain';
        const icon = {boss:'🐲', armor:'🐞', runner:'🐇', swarm:'🐜'}[kind] || (garden ? '🐛' : '🧸');
        const el = group(`<ellipse cy="22" rx="24" ry="8" fill="#44642a22"/><text class="enemy-icon">${icon}</text>${kind === 'armor' ? '<path d="M-16-20v19q16 18 32 0v-19z" fill="#c1d8ec88" stroke="#52768e" stroke-width="3"/>' : ''}${kind === 'boss' ? '<text x="-12" y="-43" font-size="24">👑</text>' : ''}<rect x="-23" y="-33" width="46" height="6" rx="3" fill="#ffffffcc"/><rect class="enemy-health" x="-23" y="-33" height="6" rx="3"/><text class="enemy-slow" x="18" y="12" font-size="20">❄</text>`);
        el.dataset.kind = kind;
        node = {el, health:el.querySelector('.enemy-health'), slow:el.querySelector('.enemy-slow'), kind}; enemies.set(e, node);
      }
      const p = C.position(s, e, location), hurt = !!fx.hurt[e.id];
      attr(node.el, 'transform', `translate(${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}) scale(${hurt ? '1.13,.87' : '1'})`);
      attr(node.el, 'class', `enemy enemy-${node.kind}${hurt ? ' enemy-hit' : ''}`);
      attr(node.health, 'width', (46 * Math.max(0, e.hp / e.max)).toFixed(2));
      attr(node.health, 'fill', e.slow ? '#6bafe2' : '#71a969'); attr(node.slow, 'display', e.slow ? 'inline' : 'none');
    }
    flying.clear(); for (const p of s.projectiles) flying.add(p);
    for (const [p, el] of shots) if (!flying.has(p)) { el.remove(); shots.delete(p); }
    for (const p of s.projectiles) {
      let el = shots.get(p);
      if (!el) {
        const radius = p.type === 1 ? 12 : 8;
        el = group(`<circle r="${radius}" fill="${['#7fba42', '#e79bc6', '#76c8ef'][p.type]}" stroke="${p.type === 2 ? '#e5fbff' : '#568b34'}" stroke-width="2"/><circle cx="-3" cy="-3" r="${radius * .3}" fill="#fff9"/>`);
        el.setAttribute('class', 'projectile'); shots.set(p, el);
      }
      attr(el, 'transform', `translate(${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)})`);
    }
    particles(fx, reduced);
  }
  return {draw, cells(root) { towers = [...root.querySelectorAll('.defender')].map(el => ({el, cell:Number(el.parentElement.dataset.cell)})); }};
};
