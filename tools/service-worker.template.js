"use strict";

const ROOT = new URL(self.registration.scope);
const PREFIX = "minigamehub:" + encodeURIComponent(ROOT.pathname) + ":";
const CACHE = PREFIX + RELEASE;
const READY = new URL("__offline_ready__", ROOT).href;
const FILES = new Map(ASSETS.map(asset => [new URL(asset.path, ROOT).href, asset]));

async function appClients() {
  return (await self.clients.matchAll({ type: "window", includeUncontrolled: true }))
    .filter(client => {
      const url = new URL(client.url);
      return url.origin === ROOT.origin && url.pathname.startsWith(ROOT.pathname);
    });
}

async function notify(message) {
  for (const client of await appClients()) client.postMessage(message);
}

let saving;
function saveRelease(repair = false) {
  if (saving) return saving;
  saving = (async () => {
    const cache = await caches.open(CACHE);
    let cursor = 0;
    let done = 0;
    async function download() {
      while (cursor < ASSETS.length) {
        const asset = ASSETS[cursor++];
        const url = new URL(asset.path, ROOT).href;
        const response = await fetch(url, { cache: "no-store", redirect: "error" });
        if (!response.ok) throw new Error("Incomplete offline release: " + asset.path);
        // Reject mixed files if a deployment switches while this install is running.
        const digest = await crypto.subtle.digest("SHA-256", await response.clone().arrayBuffer());
        const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
        if (hash !== asset.sha256) throw new Error("Release changed: " + asset.path);
        await cache.put(url, response);
        done++;
        await notify({ type: "OFFLINE_PROGRESS", done, total: ASSETS.length });
      }
    }
    // Wait for every writer before cleaning a failed install.
    const results = await Promise.allSettled(Array.from({ length: 4 }, download));
    if (results.some(result => result.status === "rejected")) {
      if (!repair) await caches.delete(CACHE);
      else await cache.delete(READY);
      await notify({ type: "OFFLINE_FAILED" });
      throw new Error("Offline release download failed; previous release retained.");
    }
    await cache.put(READY, new Response(RELEASE));
    if (repair) await notify({ type: "OFFLINE_READY", version: RELEASE });
  })().finally(() => { saving = null; });
  return saving;
}

self.addEventListener("install", event => {
  // Do not skipWaiting: games keep their current version until a safe update.
  event.waitUntil(saveRelease());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    if (!await cache.match(READY)) throw new Error("Offline release is incomplete");
    await self.clients.claim();
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await notify({ type: "OFFLINE_READY", version: RELEASE });
  })());
});

self.addEventListener("message", event => {
  event.waitUntil((async () => {
    if (event.data?.type === "OFFLINE_STATUS") {
      const keys = new Set((await (await caches.open(CACHE)).keys()).map(request => request.url));
      const ready = keys.has(READY) && [...FILES.keys()].every(url => keys.has(url));
      event.ports[0]?.postMessage({ ready, version: RELEASE });
    }
    if (event.data?.type === "OFFLINE_REPAIR") await saveRelease(true);
    if (event.data?.type === "APPLY_UPDATE") {
      const clients = await appClients();
      const source = clients.find(client => client.id === event.source?.id);
      const path = source && new URL(source.url).pathname;
      // Never replace the worker underneath another tab or a running game.
      if (clients.length !== 1 || ![ROOT.pathname, ROOT.pathname + "index.html"].includes(path)) {
        event.source?.postMessage({ type: "UPDATE_BLOCKED" });
        return;
      }
      await self.skipWaiting();
    }
  })());
});

// Safari's native audio player requests byte ranges, including while offline.
async function cachedResponse(request, cached) {
  const range = request.headers.get("Range");
  if (!range || !/\.(mp3|wav)$/i.test(new URL(request.url).pathname)) return cached;
  const bytes = await cached.arrayBuffer();
  const size = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  const start = match && match[1] ? Number(match[1]) : match && match[2] ? Math.max(0, size - Number(match[2])) : NaN;
  const end = match && match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const headers = new Headers(cached.headers);
  headers.delete("Content-Encoding");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  // Only normalize known static files; this also supports older ?v= bookmarks.
  url.search = "";
  url.hash = "";
  if (url.pathname.endsWith("/")) url.pathname += "index.html";
  if (!FILES.has(url.href)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(url.href);
    if (cached) return cachedResponse(request, cached);
    // Cache storage can be removed by the browser. Do not cache an unverified
    // network response into this immutable release.
    try { return await fetch(request, { cache: "no-store" }); }
    catch (_) { return new Response("离线文件不可用，请联网后回大厅重新保存。", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }); }
  })());
});
