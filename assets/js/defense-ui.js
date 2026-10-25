'use strict';
(() => {
  const C = DefenseCore, $ = id => document.getElementById(id), id = document.body.dataset.game;
  const garden = id === 'gardenwatch', key = `childgame.defense.${id}.v1`;
  const icons = garden ? ['🌻', '🌺', '❄️'] : ['🏹', '🎈', '❄️'];
  const FX = DefenseFX, fx = FX.fresh(), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sprite = n => `../../assets/img/defense/${garden?'garden':'castle'}-${n}.svg`;
  const names = garden ? ['阳光花', '泡泡花', '冰雪花'] : ['积木箭塔', '泡泡塔', '冰雪塔'];
  const enemyNames={plain:'普通队',runner:'快跑队',armor:'护甲队',swarm:'密集小队',boss:'首领混合队'};
  const tactics={plain:'先覆盖入口，再升级火力',runner:'速度快，搭配冰雪减速',armor:'抵挡普通弹，泡泡群攻能破甲',swarm:'成群冲来，泡泡群攻更合适',boss:'首领漏过扣 3 颗心，集中火力并减速'};
  let s = C.fresh(id), selected = -1, type = 0, paused = false, speed = 1, pending = null, sound = true, elapsed = 0, last = 0, paintIn = 0, raf = 0, savedState = '';
  try { s = C.restore(id, JSON.parse(localStorage.getItem(key))); sound = localStorage.getItem('childgame.sound') !== 'off'; } catch {}
  const activeRound = () => s.phase === 'running' || (s.phase === 'ready' && s.wave > 0);
  paused = activeRound();
  const audio = createGameAudio({ game: id, music: false, isEnabled: () => sound, isPlaying: () => s.phase === 'running', isPaused: () => paused || $('dialog').open });
  const setText = (id, value) => { const el = $(id); if (el.textContent !== value) el.textContent = value; };
  const say = text => { setText('feedback', text); };
  function save() { try { const next = JSON.stringify(s); if (next !== savedState) { localStorage.setItem(key, next); savedState = next; } setText('save-status', '进度已保存 · 离开后战斗会暂停'); } catch { setText('save-status', '暂时无法保存，关闭页面会丢失进度'); } }
  function ask(title, description, fn) { pending = fn; setText('dialog-title', title); setText('dialog-text', description); $('cancel').hidden = !fn; $('dialog').showModal(); stop(); }
  function drawCells() {
    $('cells').innerHTML = Array.from({ length: 40 }, (_, cell) => {
      const t = s.towers.find(v => v.cell === cell), can = C.buildable(id, cell);
      return `<button class="cell ${!can ? garden ? 'edge' : 'path' : ''} ${selected === cell ? 'selected' : ''}" data-cell="${cell}" ${can ? '' : 'disabled'} aria-label="第${Math.floor(cell / 8) + 1}行第${cell % 8 + 1}格${t ? `，${names[t.type]}，${t.level}级` : can ? '，空地' : '，道路'}">${t ? `<span class="defender" aria-hidden="true" style="background-image:url(${sprite(t.type)})"></span><small>${'★'.repeat(t.level)}</small>` : can ? '<span class="empty">＋</span>' : ''}</button>`;
    }).join('');
    renderer.cells($('cells'));
  }
  function panel() {
    const t = s.towers.find(v => v.cell === selected), active = ['ready', 'running'].includes(s.phase);
    $('choices').innerHTML = names.map((name, i) => `<button class="tower-choice" data-type="${i}" aria-pressed="${type === i}"><span class="defender choice-sprite" aria-hidden="true" style="background-image:url(${sprite(i)})"></span><span>${name} <span class="cost">${C.types[i].cost} ⭐</span></span><small>${['快速单攻 · 对付普通队', '范围攻击 · 克制护甲和密集队', '冰雪减速 · 拦截快跑队'][i]}</small></button>`).join('');
    $('inspector').innerHTML = t ? `<strong>${icons[t.type]} ${names[t.type]} · ${t.level}级</strong><p>升级会提高攻击力${garden ? '。' : '和攻击范围。'}</p><div class="tools-row"><button id="upgrade" ${!active || t.level >= 3 || s.coins < t.level * 25 ? 'disabled' : ''}>${t.level >= 3 ? '已满级' : `升级 ${t.level * 25} ⭐`}</button><button id="sell" ${active ? '' : 'disabled'}>收回 · 返还八成</button></div>` : `<strong>${icons[type]} 选好了${names[type]}</strong><p>点地图上的「＋」放置，需要 ${C.types[type].cost} 颗星星。${s.coins < C.types[type].cost ? '星星不足，赶走小家伙会获得星星。' : ''}</p><p>${garden ? '建议先在每一行左侧各放一朵阳光花。' : '建议先在上方道路旁放三座箭塔，再搭配泡泡塔。'}</p>`;
    $('difficulty').value = s.difficulty;
    $('difficulty').querySelector('[value=normal]').textContent=!s.rules&&s.difficulty==='normal'?'旧版进行中 · 重开升级':'策略挑战 · 10 波';
  }
  function status() {
    setText('coins', `⭐ ${s.coins}`); setText('hearts', `❤️ ${s.hearts}`); setText('wave', `第 ${s.wave} / ${C.waves(s)} 波`);
    $('start').disabled = s.phase !== 'ready'; setText('start', s.wave ? '提前开始下一波' : '准备好了 · 开始守护');
    $('pause').disabled = !activeRound(); setText('pause', paused ? '▶ 继续' : 'Ⅱ 暂停');
    setText('speed', speed === 1 ? '速度 1×' : '速度 2×'); $('veil').hidden = !(paused && activeRound());
    const preview={...s,wave:Math.min(C.waves(s),s.wave+(s.phase==='ready'?1:0))},kind=C.waveKind(preview);
    setText('wave-note', s.phase==='ready'?`${s.wave?(paused?'已暂停':'准备')+' · '+Math.ceil(s.breakLeft)+' 秒后自动开始':'布置好再开始'} · 下一波 ${C.count(preview)} 位 · ${enemyNames[kind]}。${tactics[kind]}。`:s.phase==='running'?`${paused?'已暂停 · ':''}${enemyNames[kind]} · 出发 ${s.spawned}/${C.count(s)} · 路上 ${s.enemies.length} 位。${tactics[kind]}。`:'本轮结束，可以重新布置或换个难度再挑战。');
    $('finish').hidden = !['won', 'lost'].includes(s.phase);
    if ($('finish').dataset.phase !== s.phase) { $('finish').dataset.phase = s.phase; $('finish').innerHTML = s.phase === 'won' ? `<h2>守护成功！🌟</h2><p>${C.waves(s)} 波全部完成，还剩 ${s.hearts} 颗爱心！</p>` : '<h2>一起再试试 🌱</h2><p>看看下一波的队伍类型：护甲怕泡泡、快跑怕冰雪。调整搭配再试一次。</p>';
    }
  }
  const renderer = createDefenseRenderer($('actors'), garden);
  function drawActors() { renderer.draw(s, fx, selected, reducedMotion.matches); }
  function render() { drawCells(); panel(); status(); drawActors(); }
  function changed(text) { save(); render(); say(text); audio.effect('drop', { volume: .12 }); wake(); }
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
  $('start').onclick = () => { if (C.start(s)) { paused = false; changed(`第 ${s.wave} 波出发啦！`); } };
  $('pause').onclick = () => { if (!activeRound()) return; paused = !paused; if (paused) stop(); else wake(); save(); status(); drawActors(); audio.sync(); };
  $('speed').onclick = () => { speed = speed === 1 ? 2 : 1; status(); };
  function restart(difficulty) { s = C.fresh(id, difficulty); selected = -1; type = 0; paused = false; speed = 1; Object.assign(fx,FX.fresh()); changed('新一轮开始，先把伙伴放到空地上吧。'); }
  $('restart').onclick = () => ask('重新开始这一轮吗？', '将清空本轮的地图和星星，从第一波重新布置。', () => restart(s.difficulty));
  $('difficulty').onchange = event => { const next = event.target.value; event.target.value = s.difficulty; if (next !== s.difficulty) ask('切换难度并重新开始？', '轻松入门：6 波、20 颗心。策略挑战：10 波、8 颗心。高手守护：12 波、5 颗心，敌人更密集。切换会从第一波重新开始。', () => restart(next)); };
  $('help').onclick = () => ask('一起守护吧', `${garden ? '毛毛虫从右边来。先选花，再点空地种下；花只攻击同一行前方的毛毛虫。建议先在每一行左侧种一朵阳光花。' : '小熊沿沙色道路走向城堡。先选塔，再点草地建造；塔会自动攻击范围内走得最远的小熊。点已有的塔可以看到攻击范围。'} 普通伙伴攻击快，泡泡伙伴能同时攻击附近目标，冰雪伙伴可以减速。点已有伙伴可升级或收回。挑战档中，护甲队抵挡普通弹，用泡泡破甲；快跑队要搭配冰雪。首领减速效果较弱，漏过扣 3 颗心。普通敌人奖励 5 颗星星，首领 30 颗，每波奖励 25 颗。轻松档仍为每位 7 颗、每波 35 颗。每波之间有 10 秒布置时间，然后自动开始下一波；后面的敌人更多、更结实，出发更紧凑。可以随时暂停，离开后不会继续消耗爱心。`, null);
  $('cancel').onclick = () => { pending = null; $('dialog').close(); };
  $('confirm').onclick = () => { const fn = pending; pending = null; $('dialog').close(); fn?.(); };
  $('dialog').addEventListener('cancel', () => { pending = null; });
  $('dialog').addEventListener('close', wake);
  $('sound').onclick = () => { sound = audio.toggle(); if (sound) audio.unlock(true); try { localStorage.setItem('childgame.sound', sound ? 'on' : 'off'); } catch {} audio.sync(); };
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
  function needsFrame() { return !paused && !$('dialog').open && !document.hidden && (activeRound() || s.phase === 'ready' && s.towers.length > 0 || fx.bursts.length || Object.keys(fx.shots).length || Object.keys(fx.hurt).length); }
  function wake() { if (!raf && needsFrame()) { last = 0; raf = requestAnimationFrame(frame); } }
  function suspend() { if (activeRound()) paused = true; stop(); save(); status(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else wake(); });
  window.addEventListener('pagehide', suspend); window.addEventListener('pageshow', () => { status(); wake(); });
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min((now - last) / 1000, .1) : 0; last = now;
    if (!paused && !$('dialog').open && !document.hidden ) {
      let events = [];
      // Building breaks use real play time even at 2x battle speed.
      if(s.phase==='ready') events.push(...C.tick(s,dt));
      else if(s.phase==='running') for(let i=0;i<speed && s.phase==='running';i++) events.push(...C.tick(s,dt));
      if(events.some(e=>e.kind==='start')) { save(); render(); say(`第 ${s.wave} 波出发啦！`); audio.effect('start',{volume:.12}); }
      FX.advance(fx,dt*speed,events);
      for(let type=0;type<3;type++)if(events.some(e=>e.kind==='shot'&&e.type===type))audio.effect(['shoot','rotate','merge'][type],{volume:.3});
      if(events.some(e=>e.kind==='impact'))audio.effect('hit',{volume:.18});
      if(events.some(e=>e.kind==='clear'))audio.effect('collect',{volume:.22});
      if (events.some(e => e.kind === 'leak')) audio.effect('hit', { volume: .07 });
      if (events.some(e => ['wave', 'won', 'lost'].includes(e.kind))) { save(); render(); say(s.phase === 'won' ? `${C.waves(s)} 波全部守住了！` : s.phase === 'lost' ? '换个布置再试试，你一定有新办法。' : `这一波完成！奖励 ${C.advanced(s)?25:35} 颗星星，10 秒后自动开始下一波。`); audio.effect(s.phase === 'lost' ? 'over' : 'finish', { volume: .12 }); }
      elapsed += dt; paintIn += dt;
      drawActors();
      if (paintIn >= .08) { status(); paintIn = 0; const t = s.towers.find(t => t.cell === selected); const button = $('upgrade'); if (button && t) button.disabled = !['ready', 'running'].includes(s.phase) || t.level >= 3 || s.coins < t.level * 25; }
      if (elapsed > 2) { if (activeRound()) save(); elapsed = 0; }
    }
    if (needsFrame()) raf = requestAnimationFrame(frame);
  }
  window.DefenseGame = { effects: () => C.clone(fx), snapshot: () => C.clone(s), paused: () => paused, scheduling: () => ({raf: !!raf}) };
  render(); save(); say(paused ? '欢迎回来，进度保留好了。点“继续”再玩。' : '先选伙伴，再点空地。准备好了再开始，不用着急。'); wake();
})();
