"use strict";

(() => {
  const root = new URL("../../", document.currentScript.src);
  const isLobby = [root.pathname, root.pathname + "index.html"].includes(location.pathname);
  let registration;
  let ready = false;
  let failed = false;
  let busy = false;
  let applying = false;
  let blocked = false;
  let progress = "";
  let lastCheck = 0;
  let panel, text, button;

  if (isLobby) {
    panel = document.createElement("aside");
    panel.className = "offline-panel";
    text = document.createElement("span");
    text.setAttribute("role", "status");
    button = document.createElement("button");
    button.type = "button";
    button.hidden = true;
    panel.append(text, button);
    document.querySelector("#count").before(panel);
  }

  function render() {
    if (!panel) return;
    button.hidden = true;
    button.disabled = false;
    if (applying) text.textContent = "正在更新，马上就好…";
    else if (registration?.waiting) {
      text.textContent = blocked ? "请先关闭其他游戏屋页面，再更新" : "新版已下载好，更新后即可使用";
      button.textContent = "更新";
      button.hidden = false;
    } else if (busy) text.textContent = (ready ? "正在下载新版，可继续玩… " : "正在保存离线游戏… ") + progress;
    else if (failed) {
      text.textContent = ready ? "更新暂未完成，已保存的游戏仍可离线玩" : "离线保存未完成，请联网重试";
      button.textContent = "重试";
      button.hidden = !navigator.onLine;
    } else if (ready) {
      text.textContent = navigator.onLine ? "离线已就绪 · 7 款游戏和声音已保存" : "当前离线 · 7 款游戏可正常玩";
      button.textContent = "检查更新";
      button.hidden = !navigator.onLine;
    } else text.textContent = navigator.onLine ? "正在准备离线游戏…" : "请先联网打开一次，保存离线游戏";
    panel.dataset.state = ready ? "ready" : "pending";
  }

  async function readStatus() {
    const worker = registration?.active;
    if (!worker) return;
    const result = await new Promise(resolve => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 3000);
      channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
      worker.postMessage({ type: "OFFLINE_STATUS" }, [channel.port2]);
    });
    ready = result?.ready === true;
    if (!ready && !busy && !registration.installing) failed = true;
    render();
  }

  function watch(worker) {
    if (!worker) return;
    busy = true;
    failed = false;
    render();
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" || worker.state === "activated") {
        busy = false;
        readStatus();
      }
      if (worker.state === "redundant") { busy = false; failed = true; }
      render();
    });
  }

  async function check(force = false) {
    if (!registration || !navigator.onLine || document.hidden) return;
    if (!force && Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    try {
      await registration.update();
      await readStatus();
      if (!ready && registration.active && !registration.installing && !registration.waiting) {
        busy = true;
        progress = "";
        registration.active.postMessage({ type: "OFFLINE_REPAIR" });
        render();
      }
    } catch (_) { failed = true; render(); }
  }

  async function register() {
    try {
      registration = await navigator.serviceWorker.register(new URL("sw.js", root), { scope: root.href, updateViaCache: "none" });
      registration.addEventListener("updatefound", () => watch(registration.installing));
      watch(registration.installing);
      await readStatus();
      render();
      check();
    } catch (_) { failed = true; render(); }
  }

  render();
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    if (text) text.textContent = "当前浏览器暂不支持离线保存，联网时仍可玩";
    return;
  }
  button?.addEventListener("click", async () => {
    if (registration?.waiting) {
      applying = true;
      blocked = false;
      render();
      registration.waiting.postMessage({ type: "APPLY_UPDATE" });
    } else {
      failed = false;
      render();
      if (!registration?.active && !registration?.installing) await register();
      else await check(true);
    }
  });
  navigator.serviceWorker.addEventListener("message", event => {
    const data = event.data;
    if (data?.type === "OFFLINE_PROGRESS") { busy = true; progress = `${data.done}/${data.total}`; }
    if (data?.type === "OFFLINE_READY") { ready = true; busy = false; failed = false; }
    if (data?.type === "OFFLINE_FAILED") { busy = false; failed = true; }
    if (data?.type === "UPDATE_BLOCKED") { applying = false; blocked = true; }
    render();
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (applying) location.reload();
    else readStatus();
  });
  window.addEventListener("online", () => { render(); check(true); });
  window.addEventListener("offline", render);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { readStatus(); check(); } });
  window.setInterval(check, 5 * 60 * 1000);
  register();
})();
