/* Shared touch protection, a quiet tools drawer, and cancellable level transitions. */
(() => {
  'use strict';
  const pointers = new Set();
  let menu, more, menuHooks = null, fallbackResume = null, pending = null, timer = 0;
  const editable = target => target instanceof Element && target.closest('input,textarea,[contenteditable="true"]');
  const notify = () => window.dispatchEvent(new Event('gameux:menu'));
  function cancelNext() {
    clearTimeout(timer); timer = 0;
    if (pending) {
      pending.banner.remove();
      pending.button?.removeAttribute('data-ux-auto');
      pending = null;
    }
  }
  function advance() {
    timer = 0;
    if (!pending) return;
    if (document.hidden || menu?.open || document.querySelector('dialog[open]') || !pending.valid()) { cancelNext(); return; }
    if (pointers.size) { pending.waiting = true; return; }
    const next = pending.next;
    cancelNext(); next();
  }
  function queueNext({ next, valid = () => true, button, host, delay = 3600, text = '完成啦，马上进入下一关…' }) {
    cancelNext();
    if (document.hidden || menu?.open || !valid()) return;
    const banner = document.createElement('div'); banner.className = 'ux-next'; banner.setAttribute('role', 'status');
    const label = document.createElement('span'); label.textContent = text;
    const stay = document.createElement('button'); stay.type = 'button'; stay.textContent = '留在这里'; stay.onclick = cancelNext;
    banner.append(label, stay); (host || button?.parentElement || document.querySelector('main')).append(banner);
    button?.setAttribute('data-ux-auto', 'true');
    pending = { next, valid, banner, button, waiting: false };
    timer = setTimeout(advance, delay);
  }
  function closeMenu() {
    if (!menu?.open) return;
    menu.close(); more.setAttribute('aria-expanded', 'false'); document.body.classList.remove('ux-tools-open');
    const resume = fallbackResume; fallbackResume = null;
    menuHooks?.resume?.(); resume?.(); notify();
  }
  function openMenu() {
    cancelNext();
    menu.showModal(); more.setAttribute('aria-expanded', 'true'); document.body.classList.add('ux-tools-open');
    if (menuHooks) menuHooks.suspend?.();
    else {
      // Legacy action games have no puzzle tools that need to stay enabled.
      const pause = document.getElementById('pause');
      if (pause && !pause.disabled && /暂停/.test(pause.textContent)) {
        pause.click();
        fallbackResume = () => { if (!document.hidden && !pause.disabled && /继续/.test(pause.textContent)) pause.click(); };
      }
    }
    notify();
  }
  window.GameUX = {
    queueNext, cancelNext, closeMenu,
    configure(hooks) { menuHooks = hooks; },
    isMenuOpen: () => !!menu?.open,
    transitioning: () => !!pending,
  };
  document.addEventListener('pointerdown', e => pointers.add(e.pointerId), { passive: true });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(type, e => {
    pointers.delete(e.pointerId);
    if (!pointers.size && pending?.waiting) { pending.waiting = false; timer = setTimeout(advance, 250); }
  }, { passive: true });
  // Keep pointer events (including joystick + jump) intact. Cancel only native
  // selection/zoom gestures; scrolling inside the tools dialog remains available.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, e => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  for (const type of ['selectstart', 'contextmenu', 'dragstart', 'dblclick']) document.addEventListener(type, e => { if (!editable(e.target)) e.preventDefault(); });
  for (const type of ['keydown', 'keyup']) document.addEventListener(type, e => {
    if (menu?.open || e.target.closest?.('#game-more') && ['Enter', 'Space'].includes(e.code)) e.stopPropagation();
  }, true);
  document.addEventListener('click', e => {
    if (e.target.closest?.('#undo,#restart,#retry,#result-undo,[data-level],[data-mode]')) cancelNext();
  }, true);
  const suspend = () => { pointers.clear(); cancelNext(); fallbackResume = null; closeMenu(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
  window.addEventListener('blur', suspend); window.addEventListener('pagehide', suspend);
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('game-ux');
    more = document.createElement('button'); more.id = 'game-more'; more.type = 'button'; more.className = 'ux-more';
    more.textContent = '更多'; more.setAttribute('aria-haspopup', 'dialog'); more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', 'game-tools');
    menu = document.createElement('dialog'); menu.id = 'game-tools'; menu.className = 'ux-menu'; menu.setAttribute('aria-labelledby', 'game-tools-title');
    menu.innerHTML = '<h2 id="game-tools-title">更多</h2><div class="ux-tool-list"></div><div class="ux-menu-footer"><button type="button" id="game-tools-close">返回游戏</button></div>';
    const list = menu.querySelector('.ux-tool-list'), sound = document.getElementById('sound');
    if (sound) sound.before(more); else (document.querySelector('header') || document.body).append(more);
    for (const id of ['sound','hint','help','rules','shuffle','restart','symbols','check','speed','clear']) {
      const el = document.getElementById(id);
      if (el?.tagName === 'BUTTON') list.append(el);
    }
    // Move controls themselves, preserving their handlers, state and keyboard use.
    const groups = new Set();
    for (const el of document.querySelectorAll('select#levels,select#difficulty,select#mode,select#pace')) groups.add(el.closest('label') || el);
    for (const el of document.querySelectorAll('[data-level],body:not([data-game]) [data-mode]')) {
      if (el.closest('#activity,dialog')) continue;
      if (el.parentElement.matches('nav,.levels,.modes,.difficulty')) groups.add(el.parentElement);
    }
    for (const el of groups) { el.classList.add('ux-tool-group'); list.append(el); }
    document.body.append(menu); more.onclick = openMenu;
    document.getElementById('game-tools-close').onclick = closeMenu;
    menu.addEventListener('cancel', e => { e.preventDefault(); closeMenu(); });
    menu.addEventListener('click', e => { if (e.target.closest('button')?.id !== 'game-tools-close' && e.target.closest('button')) closeMenu(); }, true);
    menu.addEventListener('change', closeMenu);
    window.dispatchEvent(new Event('resize'));
  }, { once: true });
})();
