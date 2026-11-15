(() => {
  'use strict';
  const C = window.ColorMix, A = window.ColorArt, $ = id => document.getElementById(id);
  const key = 'childgame.colormix.v1';
  let state;
  try { state = C.restore(JSON.parse(localStorage.getItem(key))); } catch { state = C.fresh(); }
  let message = '', drag = null, suppressClick = false, dragFrame = 0, stirringTimer = 0;
  const voice = new Audio(); voice.preload = 'none'; voice.volume = .85;
  const audio = createGameAudio({ game: 'colorsort', music: false, isPlaying: () => true, isEnabled: () => state.sound, isPaused: () => !!document.querySelector('dialog[open]') });
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); $('save-status').textContent = '发现和进度已保存在这台设备'; }
    catch { $('save-status').textContent = '这次可以正常玩，浏览器暂时不能保存'; }
  }
  function round() { return state.rounds[state.mode]; }
  function swatch(id, hex) { return `<span class="swatch" style="background:${hex || C.colors[id].hex}" title="${C.colors[id].name}" aria-label="${C.colors[id].name}">${C.colors[id].mark}</span>`; }
  function formula(drops) { return drops.map(c => swatch(c)).join('<span aria-hidden="true">+</span>'); }
  function stopVoice() { voice.pause(); voice.removeAttribute('src'); voice.load(); }
  function speak(id) {
    stopVoice();
    if (!state.sound || document.hidden || document.querySelector('dialog[open]')) return;
    voice.src = `../../assets/audio/colormix/${id}.mp3`;
    voice.play().catch(() => {});
  }
  function narration() {
    const t = C.task(state);
    return state.mode === 'lab' ? 'lab' : state.mode === 'detective' ? `detective-${t.color}` : state.mode === 'shades' ? `shade-${round().level}` : `target-${t.color}`;
  }
  function defaultMessage() {
    const r = round();
    if (r.won) return '太棒了！颜色让这里变得更美啦。';
    if (state.mode === 'town' && r.painted.includes(r.patch)) return '修复成功！点选另一个灰色物件，继续给小镇上色。';
    if (state.mode === 'lab') return '试试三种颜色一起混，或者加一点白色。';
    if (state.mode === 'shades') return '每加一滴白色都会更浅。对照目标，试试看。';
    if (state.mode === 'detective') return round().level < 6 ? '虚线圈里是已知的颜色，补上另一种吧。' : '从三罐颜料里选出两种颜色。';
    return '选两滴颜色，搅一搅，让魔法发生。';
  }
  function renderStory() {
    const m = state.mode, r = round(), t = C.task(state), meta = C.modes[m];
    $('mode-title').textContent = meta.name;
    $('chapter').textContent = ['PAINT & PLAY / 01', 'A LITTLE COLOR TOWN / 02', 'COLOR DETECTIVE / 03', 'MAKE A DISCOVERY / 04', 'A LITTLE BIT LIGHTER / 05'][Object.keys(C.modes).indexOf(m)];
    $('progress').textContent = m === 'lab' ? `发现 ${Object.keys(state.book).length} / 15` : `${r.won && r.level === meta.count - 1 ? '已完成 · ' : ''}${r.level + 1} / ${meta.count}`;
    $('customer').textContent = { shop: ['🐻', '🐰', '🐱'][Math.floor(r.level / 3)], town: '🏡', detective: '🕵️', lab: '🧙', shades: '🐰' }[m];
    $('mission').textContent = r.won ? (m === 'detective' ? '你找到颜色的秘密啦！' : m === 'town' ? '小镇的颜色都回来啦！' : '就是这个颜色，谢谢你！') : t.title;
    $('instruction').textContent = { shop: '请帮我调出颜色，再给礼物上色。', town: '点选一个灰色物件，帮它找回颜色。', detective: r.level < 6 ? '已知一种颜色，找出它的好搭档。' : '这次没有提示色，自己选两种试试。', lab: '没有标准答案，每个发现都有惊喜。', shades: '看目标色卡，给碗里的颜料加一点白色。' }[m];
    if (m === 'town') {
      $('scene').innerHTML = `<div class="town-grid ${r.won ? 'complete' : ''}">${C.townObjects.map((object, i) => {
        const painted = r.painted.includes(i), color = C.townColors[r.level][i];
        return `<button type="button" class="town-piece ${painted ? 'painted' : ''} ${r.patch === i ? 'selected' : ''}" data-patch="${i}" aria-pressed="${r.patch === i}" aria-label="${C.objectNames[object]}，${painted ? '已经修复' : '需要' + C.colors[color].name}" ${painted ? 'disabled' : ''}>${A.prop(object, painted ? C.colors[color].hex : undefined)}<span>${painted ? '✓ ' : ''}${C.objectNames[object]}</span></button>`;
      }).join('')}</div>`;
    } else if (m === 'detective') {
      const known = r.level < 6 ? C.createRound(m, r.level).drops[0] : null;
      $('scene').innerHTML = `<div class="mystery"><span class="mystery-glass" aria-hidden="true">${r.won ? '🌟' : '🔍'}</span><div class="mystery-formula">${known ? swatch(known) : '<span class="swatch">?</span>'}<span>+</span>${r.won ? swatch(r.drops[r.drops.length - 1]) : '<span class="swatch">?</span>'}<span>=</span>${swatch(t.color)}</div><p class="shade-caption">${r.won ? r.drops.map(c => C.colors[c].name).join(' + ') + ' = ' + t.target.name : '先猜一猜，再搅一搅验证'}</p></div>`;
      if (r.won && !known) $('scene').querySelector('.mystery-formula').innerHTML = formula(r.drops) + '<span>=</span>' + swatch(t.color);
    } else {
      const result = r.mixed ? C.mix(r.drops) : null;
      const color = m === 'lab' ? result?.hex : r.won ? t.target.hex : undefined;
      $('scene').innerHTML = A.showcase(m === 'lab' ? 'friend-' + (result?.id || 'purple') : t.object, color, r.won || m === 'lab' && !!result);
    }
    if (m === 'lab') {
      const result = r.mixed ? C.mix(r.drops) : null;
      $('target').innerHTML = result ? `${swatch(result.id, result.hex)}<strong>${result.name} · ${C.colors[result.id].friend}</strong>` : '<span>✧ 新的颜色朋友正在等你 ✧</span>';
    } else $('target').innerHTML = `<span class="target-label">目标颜色</span>${swatch(t.color, t.target.hex)}<strong>${t.target.name}</strong>${m === 'shades' ? '<span class="target-label">看清深浅哦</span>' : ''}`;
    if (m === 'shades') {
      const base = C.recipes[t.target.base], white = r.drops.filter(c => c === 'white').length;
      $('story-footer').innerHTML = `<div class="shade-scale">${[0,1,2,3].map(n => `<span class="shade-step ${n === white ? 'current' : ''} ${n === t.target.white ? 'goal' : ''}" style="background:${C.mix([...base, ...Array(n).fill('white')]).hex}" aria-label="${n}滴白色${n === t.target.white ? '，目标' : ''}"></span>`).join('')}</div><p class="shade-caption">深 ← 浅 · 虚线框是目标 · 小三角是当前颜色</p>`;
    } else $('story-footer').textContent = m === 'town' ? `已找回 ${r.painted.length} / 6 处颜色 · 第${r.level + 1}个小镇` : m === 'lab' ? '新发现会自动收进右上角的颜色图鉴' : r.won ? '你是今天的小小调色师 ✦' : '慢慢来，每一次尝试都是新发现';
  }
  function renderBench() {
    const m = state.mode, r = round(), t = C.task(state);
    const done = r.won || m === 'town' && r.painted.includes(r.patch);
    $('palette').innerHTML = t.choices.map(c => `<button type="button" class="pigment" data-color="${c}" aria-label="加入一滴${C.colors[c].name}" ${done || r.drops.length >= t.limit ? 'disabled' : ''}><span class="jar" style="background:${C.colors[c].hex}">${C.colors[c].mark}</span><span>${C.colors[c].name}</span></button>`).join('');
    const fixed = C.minimum(state);
    $('recipe').innerHTML = r.drops.map((c, i) => `<span class="swatch ${i < fixed ? 'fixed' : ''}" style="background:${C.colors[c].hex}" aria-label="${C.colors[c].name}${i < fixed ? '，已给出' : ''}">${C.colors[c].mark}</span>`).join('<span>+</span>') + (!r.drops.length ? '<span>把颜色送进小碗里</span>' : '') + (m !== 'lab' && m !== 'shades' && r.drops.length < 2 ? '<span>+</span><span class="swatch unknown">?</span>' : '');
    const preview = C.mix(r.drops), visible = r.mixed || m === 'shades';
    $('paint').setAttribute('fill', visible && preview ? preview.hex : '#e7e6dc');
    $('paint-drops').innerHTML = !visible ? r.drops.map((c, i) => `<ellipse cx="${112 + i % 4 * 30}" cy="${49 + Math.floor(i / 4) * 22}" rx="24" ry="12" fill="${C.colors[c].hex}"/>`).join('') : '';
    $('bowl').classList.toggle('mixed', r.mixed);
    $('bowl-label').textContent = r.mixed ? `调出${preview.name}啦！` : m === 'shades' ? `已经加入 ${preview.white} 滴白色` : r.drops.length ? `${r.drops.length} 滴颜色 · 点小碗搅一搅` : '等你放进第一滴颜色';
    const stirDisabled = done || !r.drops.length || r.mixed || (m !== 'lab' && r.drops.length <= fixed) || (['shop','town','detective'].includes(m) && r.drops.length < 2);
    $('stir').disabled = stirDisabled; $('bowl').disabled = stirDisabled;
    $('undo').disabled = done || r.drops.length <= fixed;
    $('empty-bowl').disabled = done || r.drops.length <= fixed;
    $('apply').hidden = m === 'lab' || r.won;
    $('apply').disabled = !r.mixed || done;
    $('apply').textContent = m === 'detective' ? '🔍 验证我的配方' : m === 'town' ? '✦ 给选中的物件上色' : '✦ 用这个颜色';
    $('next').hidden = !r.won;
    $('next').textContent = r.level === C.modes[m].count - 1 ? '完成啦！再玩一遍 ↻' : { shop: '下一位小客人 →', town: '去下一个小镇 →', detective: '下一个颜色谜题 →', shades: '下一个调色挑战 →' }[m];
    $('feedback').textContent = message || defaultMessage();
    $('feedback').classList.toggle('success', r.won || r.mixed && C.matches(state));
    $('book-count').textContent = Object.keys(state.book).length;
  }
  function render() {
    $('modes').innerHTML = Object.entries(C.modes).map(([id, m]) => `<button type="button" class="mode" data-mode="${id}" aria-pressed="${state.mode === id}"><span class="mode-icon" aria-hidden="true">${m.icon}</span><span><strong>${m.name}</strong><small>${m.short}</small></span></button>`).join('');
    renderStory(); renderBench();
  }
  function changeMode(mode) {
    if (!Object.hasOwn(C.modes, mode)) return;
    cancelDrag(); GameUX.cancelNext(); stopVoice(); state.mode = mode; message = ''; render(); save(); speak(narration());
  }
  function add(color) {
    if (document.hidden || document.querySelector('dialog[open]')) return;
    if (C.add(state, color)) { message = ''; renderBench(); if (state.mode === 'shades') renderStory(); save(); audio.effect('drop'); }
  }
  function stir() {
    if ($('stir').disabled || document.hidden || document.querySelector('dialog[open]')) return;
    const result = C.stir(state); if (!result) return;
    message = `${round().drops.map(c => C.colors[c].name).join(' + ')} = ${result.name}。${result.discovered ? '发现新朋友，已收入图鉴！' : state.mode === 'lab' ? '换个配方继续探索吧。' : '试着用这个颜色吧。'}`;
    render(); save(); audio.effect('merge'); speak(`color-${result.id}`);
    clearTimeout(stirringTimer); $('bowl').classList.remove('stirring');
    void $('bowl').offsetWidth; $('bowl').classList.add('stirring');
    stirringTimer = setTimeout(() => $('bowl').classList.remove('stirring'), 700);
  }
  function next() {
    GameUX.cancelNext(); stopVoice();
    if (C.next(state)) { message = ''; render(); save(); speak(narration()); }
    else if (round().won) openDialog('restart-dialog');
  }
  function apply() {
    if (!round().mixed || round().won) return;
    if (!C.apply(state)) {
      const t = C.task(state);
      message = state.mode === 'shades' ? (C.mix(round().drops).white < t.target.white ? '再加一滴白色，会更接近目标哦。' : '有一点太浅啦，点“少一滴”再试试。') : `这是${C.mix(round().drops).name}，目标是${t.target.name}。洗洗碗，试试另一种搭配吧。`;
      renderBench(); speak('retry'); return;
    }
    message = ''; render(); save(); audio.effect('finish'); speak('success');
    if (round().won && round().level < C.modes[state.mode].count - 1) {
      const mode = state.mode, level = round().level;
      const advance = () => {
        // A slow load or a long narration must finish before moving to the next task.
        if (state.sound && !voice.paused && !voice.ended) queue(1000);
        else next();
      };
      const queue = delay => GameUX.queueNext({ next: advance, valid: () => !document.hidden && state.mode === mode && round().level === level && round().won,
        host: $('transition'), button: $('next'), delay, text: '欣赏一下，马上开始新任务…' });
      queue(6500);
    }
  }
  function collection() {
    $('collection').innerHTML = Object.entries(C.colors).map(([id, color]) => {
      const drops = state.book[id];
      return `<article class="color-card ${drops ? '' : 'locked'}">${drops ? A.prop('friend-' + id, C.mix(drops).hex) : '<div class="lock-icon" aria-hidden="true">?</div>'}<strong>${drops ? color.name + ' · ' + color.friend : '等待发现'}</strong>${drops ? `<div class="recipe">${formula(drops)}</div><p>${drops.map(c => C.colors[c].name).join(' + ')}</p>` : '<p>到实验室寻找新的搭配</p>'}</article>`;
    }).join('');
  }
  function openDialog(id) { GameUX.cancelNext(); cancelDrag(); stopVoice(); $(id).showModal(); audio.sync(); }
  function cancelDrag() {
    if (drag && $('palette').hasPointerCapture(drag.id)) $('palette').releasePointerCapture(drag.id);
    drag = null; cancelAnimationFrame(dragFrame); dragFrame = 0;
    $('drag-ghost').hidden = true; $('bowl').classList.remove('is-over');
  }
  function paintDrag() {
    dragFrame = 0; if (!drag?.moved) return;
    const ghost = $('drag-ghost'); ghost.hidden = false; ghost.style.background = C.colors[drag.color].hex; ghost.textContent = C.colors[drag.color].mark;
    ghost.style.transform = `translate(${drag.x - 27}px,${drag.y - 27}px)`;
    const box = $('bowl').getBoundingClientRect();
    drag.over = drag.x >= box.left && drag.x <= box.right && drag.y >= box.top && drag.y <= box.bottom;
    $('bowl').classList.toggle('is-over', drag.over);
  }
  $('palette').addEventListener('pointerdown', e => {
    const button = e.target.closest('[data-color]');
    if (!button || button.disabled || drag || !e.isPrimary || e.button !== 0) return;
    suppressClick = false;
    drag = { id: e.pointerId, color: button.dataset.color, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false, over: false };
    $('palette').setPointerCapture(e.pointerId);
  });
  $('palette').addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.moved ||= Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 8;
    if (drag.moved) { suppressClick = true; if (!dragFrame) dragFrame = requestAnimationFrame(paintDrag); }
  });
  $('palette').addEventListener('pointerup', e => {
    if (!drag || drag.id !== e.pointerId) return;
    drag.x = e.clientX; drag.y = e.clientY; paintDrag();
    const { color, moved, over } = drag;
    // Capture on the persistent palette keeps DOM updates from stealing a gesture.
    suppressClick = true; cancelDrag();
    if (!moved || over) add(color);
  });
  for (const event of ['pointercancel', 'lostpointercapture']) $('palette').addEventListener(event, e => {
    if (drag?.id === e.pointerId) { suppressClick = true; cancelDrag(); }
  });
  $('palette').addEventListener('click', e => {
    const button = e.target.closest('[data-color]');
    if (suppressClick && e.detail !== 0) { suppressClick = false; return; }
    if (button && !button.disabled) add(button.dataset.color);
  });
  $('modes').addEventListener('click', e => { const button = e.target.closest('[data-mode]'); if (button) changeMode(button.dataset.mode); });
  $('scene').addEventListener('click', e => {
    const button = e.target.closest('[data-patch]');
    if (button && C.selectPatch(state, Number(button.dataset.patch))) { message = ''; render(); save(); speak(narration()); }
  });
  $('stir').onclick = stir; $('bowl').onclick = stir; $('apply').onclick = apply; $('next').onclick = next;
  $('undo').onclick = () => { GameUX.cancelNext(); if (C.undo(state)) { message = ''; render(); save(); audio.effect('move'); } };
  $('empty-bowl').onclick = () => { if (C.reset(state)) { message = ''; render(); save(); audio.effect('drop'); stopVoice(); } };
  $('hint').onclick = () => {
    const t = C.task(state);
    message = t.drops ? `试试这个配方：${t.drops.map(c => C.colors[c].name).join(' + ')}。` : '红黄蓝各放一滴，会发生什么？再试着加入白色吧。';
    renderBench();
  };
  $('sound').onclick = () => { state.sound = audio.toggle(); stopVoice(); if (state.sound) audio.unlock(true); audio.sync(); save(); };
  $('listen').onclick = () => {
    if (!state.sound) { message = '声音已关闭，可以在“更多”里开启。'; renderBench(); return; }
    speak(narration());
  };
  $('book-button').onclick = () => { collection(); openDialog('book-dialog'); };
  $('help').onclick = () => openDialog('help-dialog');
  $('restart').onclick = () => openDialog('restart-dialog');
  $('confirm-restart').onclick = () => {
    GameUX.cancelNext(); state.rounds[state.mode] = C.createRound(state.mode); message = '';
    $('restart-dialog').close(); render(); save(); speak(narration());
  };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(d => { d.addEventListener('close', () => { audio.sync(); $('book-button').focus({ preventScroll: true }); }); });
  function suspend() { GameUX.cancelNext(); cancelDrag(); stopVoice(); clearTimeout(stirringTimer); $('bowl').classList.remove('stirring'); }
  GameUX.configure({ suspend, resume: () => audio.sync() });
  document.addEventListener('visibilitychange', () => { document.body.classList.toggle('sleeping', document.hidden); if (document.hidden) suspend(); });
  window.addEventListener('pagehide', suspend); window.addEventListener('blur', suspend); window.addEventListener('resize', cancelDrag);
  window.ColorGame = { snapshot: () => JSON.parse(JSON.stringify(state)) };
  render();
})();
