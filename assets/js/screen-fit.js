/* Fit tablet game content to the visible Safari viewport, including changing toolbars.
   Layout first, modest proportional fitting second; never move a target under a finger. */
(() => {
  const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map(el => el.href).join(' ');
  const family = /defense\.css/.test(sheets) ? 'defense' : /cozy\.css/.test(sheets) ? 'cozy' : /academy\.css/.test(sheets) ? 'academy' : /learning\.css/.test(sheets) ? 'learning' : /games\/sudoku\//.test(location.pathname) ? 'sudoku' : /games\/fruitcut\//.test(location.pathname) ? 'fruitcut' : '';
  if (!family) return;
  document.body.dataset.screen = family;
  const main = document.querySelector('main'), pointers = new Set();
  let scheduled = 0;
  function fit() {
    scheduled = 0;
    if (pointers.size || document.querySelector('dialog[open]')) return;
    const tablet = innerWidth >= 700;
    document.body.classList.toggle('screen-fit', tablet);
    main.style.zoom = ''; main.style.width = ''; main.style.setProperty('--screen-scale', '1');
    if (!tablet) return;
    const height = Math.min(innerHeight, window.visualViewport?.height || innerHeight);
    document.body.style.setProperty('--screen-height', `${height}px`);
    const style = getComputedStyle(document.body);
    const siblings = [...document.body.children].filter(el => el !== main && !['SCRIPT', 'DIALOG', 'LINK'].includes(el.tagName) && getComputedStyle(el).position !== 'fixed' && getComputedStyle(el).display !== 'none');
    const occupied = siblings.reduce((sum, el) => { const css = getComputedStyle(el); return sum + el.getBoundingClientRect().height + parseFloat(css.marginTop) + parseFloat(css.marginBottom); }, 0);
    const available = height - occupied - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 4;
    const width = main.getBoundingClientRect().width;
    let scale = 1;
    // Preserve usable touch targets while fitting the surrounding illustration/text.
    for (let i = 0; i < 6; i++) {
      const natural = Math.max(main.scrollHeight, main.getBoundingClientRect().height);
      scale = Math.min(1, available / Math.max(1, natural));
      main.style.setProperty('--screen-scale', String(Math.max(.1, scale)));
    }
    main.style.width = `${width}px`; main.style.zoom = String(Math.max(.1, scale));
  }
  function schedule() { if (!scheduled) scheduled = requestAnimationFrame(fit); }
  document.addEventListener('pointerdown', e => pointers.add(e.pointerId));
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, e => { pointers.delete(e.pointerId); schedule(); });
  document.addEventListener('visibilitychange', () => { pointers.clear(); schedule(); });
  function resized() { pointers.clear(); if (scheduled) cancelAnimationFrame(scheduled); fit(); }
  window.addEventListener('resize', resized); window.visualViewport?.addEventListener('resize', resized);
  // Ignore animation layers; game menus/results can change the required height.
  new MutationObserver(records => {
    if (records.some(r => r.type === 'attributes' ? r.oldValue !== r.target.getAttribute(r.attributeName) : (!r.target.parentElement?.closest('svg,canvas,#actors,#cells,.stats,#coins,#hearts,#wave,#wave-note,#save-status,#feedback,[hidden]') && !r.target.closest?.('svg,#actors,#cells,.stats,[hidden]')))) schedule();
  }).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });
  document.querySelectorAll('dialog').forEach(el => el.addEventListener('close', schedule));
  document.fonts?.ready.then(schedule); fit();
})();
