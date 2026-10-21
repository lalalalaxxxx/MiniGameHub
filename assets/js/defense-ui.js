'use strict';
(() => {
  const C = DefenseCore, $ = id => document.getElementById(id), id = document.body.dataset.game;
  const garden = id === 'gardenwatch', key = `childgame.defense.${id}.v1`;
  const icons = garden ? ['🌻', '🌺', '❄️'] : ['🏹', '🎈', '❄️'];
  const names = garden ? ['阳光花', '泡泡花', '冰雪花'] : ['积木箭塔', '泡泡塔', '冰雪塔'];
  let s = C.fresh(id), selected = -1, type = 0, paused = false, speed = 1, pending = null, sound = true, beams = [], elapsed = 0, last = 0, paintIn = 0;
  try { s = C.restore(id, JSON.parse(localStorage.getItem(key))); sound = localStorage.getItem('childgame.sound') !== 'off'; } catch {}
  paused = s.phase === 'running';
  const audio = createGameAudio({ game: id, music: false, isEnabled: () => sound, isPlaying: () => s.phase === 'running', isPaused: () => paused || $('dialog').open });
  const say = text => { $('feedback').textContent = text; };
  function save() { try { localStorage.setItem(key, JSON.stringify(s)); $('save-status').textContent = '进度已保存 · 离开后战斗会暂停'; } catch { $('save-status').textContent = '暂时无法保存，关闭页面会丢失进度'; } }
  function ask(title, description, fn) { pending = fn; $('dialog-title').textContent = title; $('dialog-text').textContent = description; $('cancel').hidden = !fn; $('dialog').showModal(); }
  function drawCells() {
    $('cells').innerHTML = Array.from({ length: 40 }, (_, cell) => {
      const t = s.towers.find(v => v.cell === cell), can = C.buildable(id, cell);
      return `<button class="cell ${!can ? garden ? 'edge' : 'path' : ''} ${selected === cell ? 'selected' : ''}" data-cell="${cell}" ${can ? '' : 'disabled'} aria-label="第${Math.floor(cell / 8) + 1}行第${cell % 8 + 1}格${t ? `，${names[t.type]}，${t.level}级` : can ? '，空地' : '，道路'}">${t ? `${icons[t.type]}<small>${'★'.repeat(t.level)}</small>` : can ? '<span class="empty">＋</span>' : ''}</button>`;
    }).join('');
  }
  function panel() {
    const t = s.towers.find(v => v.cell === selected), active = ['ready', 'running'].includes(s.phase);
    $('choices').innerHTML = names.map((name, i) => `<button class="tower-choice" data-type="${i}" aria-pressed="${type === i}"><span class="icon">${icons[i]}</span><span>${name} <span class="cost">${C.types[i].cost} ⭐</span></span><small>${['快速攻击单个目标', '同时攻击附近目标', '让目标慢慢走'][i]}</small></button>`).join('');
    $('inspector').innerHTML = t ? `<strong>${icons[t.type]} ${names[t.type]} · ${t.level}级</strong><p>升级会提高攻击力${garden ? '。' : '和攻击范围。'}</p><div class="tools-row"><button id="upgrade" ${!active || t.level >= 3 || s.coins < t.level * 25 ? 'disabled' : ''}>${t.level >= 3 ? '已满级' : `升级 ${t.level * 25} ⭐`}</button><button id="sell" ${active ? '' : 'disabled'}>收回 · 返还八成</button></div>` : `<strong>${icons[type]} 选好了${names[type]}</strong><p>点地图上的「＋」放置，需要 ${C.types[type].cost} 颗星星。${s.coins < C.types[type].cost ? '星星不足，赶走小家伙会获得星星。' : ''}</p><p>${garden ? '建议先在每一行左侧各放一朵阳光花。' : '建议先在上方道路旁放三座箭塔，再搭配泡泡塔。'}</p>`;
    $('difficulty').value = s.difficulty;
  }
  function status() {
    $('coins').textContent = `⭐ ${s.coins}`; $('hearts').textContent = `❤️ ${s.hearts}`; $('wave').textContent = `第 ${s.wave} / 6 波`;
    $('start').disabled = s.phase !== 'ready'; $('start').textContent = s.wave ? '准备好了 · 下一波' : '准备好了 · 开始守护';
    $('pause').disabled = s.phase !== 'running'; $('pause').textContent = paused ? '▶ 继续' : 'Ⅱ 暂停';
    $('speed').textContent = speed === 1 ? '速度 1×' : '速度 2×'; $('veil').hidden = !(paused && s.phase === 'running');
    $('wave-note').textContent = s.phase === 'ready' ? `准备时间不限。下一波有 ${5 + (s.wave + 1) * 2} 位小家伙，先布置，再点开始。每完成一波奖励 35 颗星星。` : s.phase === 'running' ? `${paused ? '已经暂停，点“继续”再玩。' : '守护中，也可以继续建造和升级。'} 已出发 ${s.spawned} / ${C.count(s)}，路上还有 ${s.enemies.length} 位。` : '这一轮结束了，可以重新布置，再来一次。';
    $('finish').hidden = !['won', 'lost'].includes(s.phase);
    $('finish').innerHTML = s.phase === 'won' ? '<h2>守护成功！🌟</h2><p>六波全部完成！你的布置保护了大家。</p>' : '<h2>一起再试试 🌱</h2><p>试试多放几座攻击塔，或升级道路旁的伙伴。可以选择轻松模式再来一轮。</p>';
  }
  function drawActors() {
    const tower = s.towers.find(t => t.cell === selected);
    let markup = '';
    if (tower && !garden) { const p = C.point(tower.cell); markup += `<circle cx="${p.x * 100}" cy="${p.y * 100}" r="${(C.types[tower.type].range + (tower.level - 1) * .2) * 100}" fill="#fff2" stroke="#5a7a6a66" stroke-width="3" stroke-dasharray="8 8"/>`; }
    for (const e of s.enemies) { const p = C.position(s, e); markup += `<g transform="translate(${p.x * 100},${p.y * 100})"><ellipse cy="22" rx="24" ry="8" fill="#44642a22"/><text class="enemy-icon">${garden ? '🐛' : '🧸'}</text><rect x="-23" y="-33" width="46" height="6" rx="3" fill="#ffffffcc"/><rect x="-23" y="-33" width="${46 * Math.max(0, e.hp / e.max)}" height="6" rx="3" fill="${e.slow ? '#6bafe2' : '#71a969'}"/>${e.slow ? '<text x="18" y="12" font-size="20">❄</text>' : ''}</g>`; }
    for (const beam of beams) markup += `<line x1="${beam.from.x * 100}" y1="${beam.from.y * 100}" x2="${beam.to.x * 100}" y2="${beam.to.y * 100}" stroke="${['#ebc64c', '#e899bd', '#7dbbdc'][beam.type]}" stroke-width="${beam.type === 1 ? 10 : 5}" stroke-linecap="round" opacity=".8"/>`;
    $('actors').innerHTML = markup;
  }
  function render() { drawCells(); panel(); status(); drawActors(); }
  function changed(text) { save(); render(); say(text); audio.effect('drop', { volume: .12 }); }
  $('cells').addEventListener('click', event => {
    const el = event.target.closest('[data-cell]'); if (!el || el.disabled) return;
    const cell = Number(el.dataset.cell);
    if (s.towers.some(t => t.cell === cell)) { selected = cell; render(); return; }
    selected = cell;
    if (C.build(s, cell, type)) changed(`放好了${names[type]}。点它可以升级或收回。`);
    else { render(); say(['won', 'lost'].includes(s.phase) ? '这一轮结束了，点“重新开始”再玩。' : '星星不够啦，可以等待获得星星，或收回其他伙伴。'); }
  });
  $('choices').addEventListener('click', event => { const el = event.target.closest('[data-type]'); if (!el) return; type = Number(el.dataset.type); selected = -1; render(); say(`选中了${names[type]}，再点地图上的空地。`); });
  $('inspector').addEventListener('click', event => {
    if (event.target.id === 'upgrade' && C.upgrade(s, selected)) changed('升级好了，攻击更有力！');
    if (event.target.id === 'sell' && C.sell(s, selected)) { selected = -1; changed('已经收回，返还了八成星星。'); }
  });
  $('start').onclick = () => { if (C.start(s)) { paused = false; beams = []; changed(`第 ${s.wave} 波出发啦！`); } };
  $('pause').onclick = () => { if (s.phase !== 'running') return; paused = !paused; beams = []; save(); status(); drawActors(); audio.sync(); };
  $('speed').onclick = () => { speed = speed === 1 ? 2 : 1; status(); };
  function restart(difficulty) { s = C.fresh(id, difficulty); selected = -1; type = 0; paused = false; beams = []; speed = 1; changed('新一轮开始，先把伙伴放到空地上吧。'); }
  $('restart').onclick = () => ask('重新开始这一轮吗？', '将清空本轮的地图和星星，从第一波重新布置。', () => restart(s.difficulty));
  $('difficulty').onchange = event => { const next = event.target.value; event.target.value = s.difficulty; if (next !== s.difficulty) ask('切换难度并重新开始？', '轻松模式有更多星星和爱心；挑战模式的小家伙更结实，走得稍快。', () => restart(next)); };
  $('help').onclick = () => ask('一起守护吧', `${garden ? '毛毛虫从右边来。先选花，再点空地种下；花只攻击同一行前方的毛毛虫。建议先在每一行左侧种一朵阳光花。' : '小熊沿沙色道路走向城堡。先选塔，再点草地建造；塔会自动攻击范围内走得最远的小熊。点已有的塔可以看到攻击范围。'} 普通伙伴攻击快，泡泡伙伴能同时攻击附近目标，冰雪伙伴可以减速。点已有伙伴可升级或收回。赶走一个获得 7 颗星星，每完成一波额外获得 35 颗。到达终点会扣一颗爱心，坚持六波就成功。可以随时暂停，离开后不会继续消耗爱心。`, null);
  $('cancel').onclick = () => { pending = null; $('dialog').close(); };
  $('confirm').onclick = () => { const fn = pending; pending = null; $('dialog').close(); fn?.(); };
  $('dialog').addEventListener('cancel', () => { pending = null; });
  $('sound').onclick = () => { sound = audio.toggle(); if (sound) audio.unlock(true); try { localStorage.setItem('childgame.sound', sound ? 'on' : 'off'); } catch {} audio.sync(); };
  function suspend() { if (s.phase === 'running') paused = true; beams = []; save(); status(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); last = 0; });
  window.addEventListener('pagehide', suspend); window.addEventListener('pageshow', () => { last = 0; status(); });
  function frame(now) {
    const dt = last ? Math.min((now - last) / 1000, .1) : 0; last = now;
    if (!paused && !$('dialog').open && !document.hidden && s.phase === 'running') {
      let events = []; for (let i = 0; i < speed; i++) events.push(...C.tick(s, dt));
      beams = beams.map(v => ({ ...v, life: v.life - dt })).filter(v => v.life > 0);
      beams.push(...events.filter(e => e.kind === 'shot').map(e => ({ ...e, life: .12 })));
      if (events.some(e => e.kind === 'shot')) audio.effect('move', { volume: .035 });
      if (events.some(e => e.kind === 'clear')) audio.effect('collect', { volume: .09 });
      if (events.some(e => e.kind === 'leak')) audio.effect('hit', { volume: .07 });
      if (events.some(e => ['wave', 'won', 'lost'].includes(e.kind))) { save(); render(); say(s.phase === 'won' ? '六波全部守住了！' : s.phase === 'lost' ? '换个布置再试试，你一定有新办法。' : '这一波完成！准备好了再开始下一波。'); audio.effect(s.phase === 'lost' ? 'over' : 'finish', { volume: .12 }); }
      elapsed += dt; paintIn += dt;
      if (paintIn >= .08) { status(); drawActors(); paintIn = 0; const t = s.towers.find(t => t.cell === selected); const button = $('upgrade'); if (button && t) button.disabled = !['ready', 'running'].includes(s.phase) || t.level >= 3 || s.coins < t.level * 25; }
      if (elapsed > 2) { save(); elapsed = 0; }
    }
    requestAnimationFrame(frame);
  }
  window.DefenseGame = { snapshot: () => C.clone(s), paused: () => paused };
  render(); save(); say(paused ? '欢迎回来，进度保留好了。点“继续”再玩。' : '先选伙伴，再点空地。准备好了再开始，不用着急。'); requestAnimationFrame(frame);
})();
