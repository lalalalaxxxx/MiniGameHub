const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { chromium, webkit } = require('playwright');

const root = path.resolve(__dirname, '..');
const games = JSON.parse(fs.readFileSync(path.join(root, 'games/manifest.json'), 'utf8')).map(g => g.id);
const generated = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const assets = JSON.parse(generated.match(/^const ASSETS = (.+);$/m)[1]);
const template = fs.readFileSync(path.join(root, 'tools/service-worker.template.js'), 'utf8');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function release(label) {
  const files = new Map(assets.map(({ path: file }) => {
    let bytes = fs.readFileSync(path.join(root, file));
    if (file.endsWith('.html')) bytes = Buffer.from(bytes.toString().replace('<body>', `<body data-test-release="${label}">`));
    return [file, bytes];
  }));
  const manifest = assets.map(({ path: file }) => ({ path: file, sha256: hash(files.get(file)) }));
  const version = hash(JSON.stringify(manifest) + template).slice(0, 16);
  files.set('sw.js', Buffer.from(`const RELEASE = "${version}";\nconst ASSETS = ${JSON.stringify(manifest)};\n${template}`));
  return { files, version };
}

test('complete offline install, all games/audio, atomic updates, failed update, cache repair', { timeout: 120000 }, async () => {
  let deployed = release('A');
  let broken = false;
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
  const server = http.createServer((req, res) => {
    let file = new URL(req.url, 'http://localhost').pathname;
    if (!file.startsWith('/minigames/')) { res.writeHead(404); res.end(); return; }
    file = file.slice('/minigames/'.length);
    if (!file || file.endsWith('/')) file += 'index.html';
    const bytes = deployed.files.get(file);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    if (!bytes) { res.writeHead(404); res.end(); return; }
    res.end(broken && file === 'assets/audio/tetris.mp3' ? 'incorrect release bytes' : bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/minigames/`;
  const engine = process.env.TEST_BROWSER === 'webkit' ? webkit : chromium;
  const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await engine.launch({ headless: true, ...(engine === chromium && fs.existsSync(localChrome) ? { executablePath: localChrome } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
    await context.addInitScript(() => {
      window.__audioDecoded = 0;
      window.__audioDecodeErrors = [];
      const Native = window.AudioContext || window.webkitAudioContext;
      if (Native) window.AudioContext = class extends Native {
        decodeAudioData(...args) {
          return super.decodeAudioData(...args).then(buffer => { window.__audioDecoded++; return buffer; })
            .catch(error => { window.__audioDecodeErrors.push(error.message); throw error; });
        }
      };
    });
    const errors = [];
    context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
    let lobby = await context.newPage();
    const ready = page => page.waitForFunction(() => document.querySelector('.offline-panel')?.dataset.state === 'ready');
    const waitForUpdate = page => page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
    const requestUpdate = page => page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    const version = page => page.evaluate(async () => {
      const worker = (await navigator.serviceWorker.getRegistration()).active;
      return new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = e => { channel.port1.close(); resolve(e.data.version); };
        worker.postMessage({ type: 'OFFLINE_STATUS' }, [channel.port2]);
      });
    });
    await lobby.goto(base);
    await ready(lobby);
    assert.equal(await lobby.locator('.card').count(), games.length);
    assert.equal(await version(lobby), deployed.version);
    await lobby.evaluate(() => caches.open('another-app-cache'));
    console.log('PASS first installation saves the complete release');

    await context.setOffline(true);
    await lobby.reload();
    await ready(lobby);
    assert.equal(await lobby.locator('.card').count(), games.length);
    // Windows Playwright WebKit omits Web Audio. Still verify every cached sound
    // byte in that engine; Chromium (and WebKit builds with audio) also decode it.
    const supportsAudio = await lobby.evaluate(() => !!(window.AudioContext || window.webkitAudioContext));
    const audioFiles = assets.filter(asset => asset.path.startsWith('assets/audio/'));
    assert(await lobby.evaluate(async ({ base, audioFiles }) => {
      for (const asset of audioFiles) {
        const response = await fetch(base + asset.path + '?v=retro-1');
        if (!response.ok) return false;
        const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
        const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        if (hash !== asset.sha256) return false;
      }
      return true;
    }, { base, audioFiles }));
    if (!supportsAudio) console.log('NOTE this WebKit build has no Web Audio API; verified all offline audio bytes instead of decoding');
    for (const game of games) {
      const page = await context.newPage();
      await page.goto(base + `games/${game}/index.html?v=old-bookmark`);
      if (supportsAudio) await page.waitForFunction(count => window.__audioDecoded === count, game === 'quietbook' ? 12 : 13).catch(async error => {
        console.error(game, await page.evaluate(() => ({ decoded: window.__audioDecoded, errors: window.__audioDecodeErrors,
          audio: performance.getEntriesByType('resource').filter(r => r.name.includes('/audio/')).map(r => r.name) })));
        throw error;
      });
      assert.equal(await page.locator('body').getAttribute('data-test-release'), 'A');
      await page.locator(game === 'quietbook' ? '[data-preset="picnic"]' : game === 'whack' ? '#mainAction' : '#restart').click();
      if (game === 'snake') await page.keyboard.press('ArrowUp');
      await page.waitForFunction(state => document.querySelector('#sound').dataset.audioState === state, supportsAudio ? 'on' : 'unsupported');
      await page.close();
    }
    await lobby.close();
    lobby = await context.newPage();
    await lobby.goto(base + '?v=old-bookmark');
    await ready(lobby);
    const alias = await context.newPage();
    await alias.goto(base + 'games/tetris/');
    if (supportsAudio) await alias.waitForFunction(() => window.__audioDecoded === 13);
    await alias.close();
    console.log('PASS offline reopen, all games and their audio, directory/query aliases');

    await context.setOffline(false);
    const gameTab = await context.newPage();
    await gameTab.goto(base + 'games/tetris/index.html');
    deployed = release('B');
    await requestUpdate(lobby);
    await waitForUpdate(lobby);
    assert.equal(await gameTab.locator('body').getAttribute('data-test-release'), 'A');
    await lobby.locator('.offline-panel button').click();
    await lobby.waitForFunction(() => document.querySelector('.offline-panel').textContent.includes('关闭其他'));
    assert.notEqual(await version(gameTab), deployed.version);
    await gameTab.close();
    await lobby.locator('.offline-panel button').click();
    await lobby.waitForFunction(() => document.body.dataset.testRelease === 'B');
    await ready(lobby);
    assert.equal(await version(lobby), deployed.version);
    assert(await lobby.evaluate(async () => (await caches.keys()).includes('another-app-cache')));
    console.log('PASS updates wait for safe activation and leave other apps untouched');

    const workingVersion = deployed.version;
    deployed = release('C');
    broken = true;
    await requestUpdate(lobby);
    await lobby.waitForFunction(() => document.querySelector('.offline-panel').textContent.includes('更新暂未完成'));
    assert.equal(await version(lobby), workingVersion);
    await context.setOffline(true);
    await lobby.reload();
    await ready(lobby);
    assert.equal(await lobby.locator('body').getAttribute('data-test-release'), 'B');
    console.log('PASS mismatched downloads reject the entire update; old release still works offline');

    broken = false;
    await context.setOffline(false);
    await requestUpdate(lobby);
    await waitForUpdate(lobby);
    await lobby.locator('.offline-panel button').click();
    await lobby.waitForFunction(() => document.body.dataset.testRelease === 'C');
    await ready(lobby);
    await lobby.evaluate(async base => {
      const name = (await caches.keys()).find(name => name.startsWith('minigamehub:'));
      await (await caches.open(name)).delete(base + 'assets/audio/snake.mp3');
    }, base);
    await lobby.locator('.offline-panel button').click();
    await lobby.waitForFunction(async base => {
      const name = (await caches.keys()).find(name => name.startsWith('minigamehub:'));
      return !!await (await caches.open(name)).match(base + 'assets/audio/snake.mp3');
    }, base);
    await ready(lobby);
    assert.deepEqual(errors, []);
    console.log('PASS retry after failure and repair of an evicted cached file');
    await context.close();

    broken = true;
    const freshContext = await browser.newContext();
    const fresh = await freshContext.newPage();
    await fresh.goto(base);
    await fresh.waitForFunction(() => document.querySelector('.offline-panel').textContent.includes('离线保存未完成'));
    assert.equal(await fresh.locator('.offline-panel').getAttribute('data-state'), 'pending');
    assert.equal(await fresh.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('minigamehub:')).length), 0);
    broken = false;
    await fresh.locator('.offline-panel button').click();
    await ready(fresh);
    await freshContext.setOffline(true);
    await fresh.reload();
    await ready(fresh);
    await freshContext.close();
    console.log('PASS interrupted first install never claims readiness and can be retried');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
