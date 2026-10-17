"use strict";

const gameAudioBaseURL = new URL("../audio/", document.currentScript.src);

// One mixer per page. Only a real touch/click/key gesture resumes Web Audio.
window.createGameAudio = function ({ game, isPlaying, isEnabled, isPaused = () => false }) {
  const base = gameAudioBaseURL;
  const effects = ["move", "rotate", "drop", "collect", "merge", "clear", "hit", "crash", "start", "finish", "over", "shoot"];
  const buffers = new Map();
  const voices = new Set();
  const lastPlayed = new Map();
  let context, musicGain, effectGain, musicSource;
  let loading = false;
  let musicOffset = 0;
  let musicStarted = 0;
  let leaving = false;

  function audible() {
    return !leaving && !document.hidden && isEnabled() && !isPaused();
  }

  function stopMusic() {
    if (!musicSource) return;
    musicOffset += context.currentTime - musicStarted;
    musicSource.stop();
    musicSource.disconnect();
    musicSource = null;
  }

  function sync() {
    if (!context) return;
    const allowed = audible();
    effectGain.gain.value = allowed ? .75 : 0;
    if (!allowed) {
      for (const voice of voices) voice.stop();
      voices.clear();
    }
    if (!allowed || !isPlaying() || context.state !== "running") {
      stopMusic();
      return;
    }
    const buffer = buffers.get("music");
    if (!buffer || musicSource) return;
    musicSource = context.createBufferSource();
    musicSource.buffer = buffer;
    musicSource.loop = true;
    musicSource.connect(musicGain);
    musicStarted = context.currentTime;
    musicSource.start(0, musicOffset % buffer.duration);
  }

  async function load(name, file) {
    try {
      const response = await fetch(new URL(file, base));
      if (!response.ok) throw new Error("Audio unavailable");
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      buffers.set(name, buffer);
      sync();
    } catch (_) {
      // A failed sound download must not interrupt play.
    }
  }

  function unlock() {
    if (leaving || document.hidden || !isEnabled()) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!context) {
      context = new AudioContext();
      musicGain = context.createGain();
      effectGain = context.createGain();
      musicGain.gain.value = .55;
      effectGain.gain.value = .75;
      musicGain.connect(context.destination);
      effectGain.connect(context.destination);
      context.addEventListener("statechange", sync);
    }
    if (context.state !== "running") context.resume().then(sync).catch(() => {});
    if (!loading) {
      loading = true;
      load("music", game + ".mp3");
      effects.forEach(name => load(name, name + ".wav"));
    }
    sync();
  }

  function effect(name, { rate = 1, volume = 1 } = {}) {
    if (!context || context.state !== "running" || !audible()) return;
    const buffer = buffers.get(name);
    if (!buffer) return; // Do not replay stale actions when downloads finish.
    const now = context.currentTime;
    if (now - (lastPlayed.get(name) ?? -Infinity) < (name === "shoot" ? .10 : .035)) return;
    if (voices.size >= 12) return;
    lastPlayed.set(name, now);
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(effectGain);
    voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
    source.start();
  }

  // Listen after game handlers so a start/resume button has already changed state.
  for (const type of ["pointerdown", "pointerup", "click", "keydown"]) {
    document.addEventListener(type, event => {
      if (!event.isTrusted) return;
      unlock();
      queueMicrotask(sync);
    });
  }
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => { leaving = true; sync(); });
  window.addEventListener("pageshow", () => { leaving = false; sync(); });
  // Includes automatic game-over and pauses, without modifying physics loops.
  window.setInterval(sync, 100);
  return { unlock, effect, sync };
};
