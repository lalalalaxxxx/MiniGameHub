"use strict";

const gameAudioBaseURL = new URL("../audio/", document.currentScript.src);

// One mixer per page. Only a real touch/click/key gesture resumes Web Audio.
window.createGameAudio = function ({ game, isPlaying, isEnabled, isPaused = () => false, music = true }) {
  const base = gameAudioBaseURL;
  const effects = ["move", "rotate", "drop", "collect", "merge", "clear", "hit", "crash", "start", "finish", "over", "shoot"];
  const customEffects = {
    birdblast: ["clear", "merge", "collect", "finish", "drop"],
    candyland: ["clear", "merge", "collect", "finish", "drop"],
    gemquest: ["clear", "merge", "collect", "finish", "drop"],
    toyblast: ["clear"],
    fruitgarden: ["clear"],
    aquarium: ["collect", "drop"],
    snake: ["collect"],
    "2048": ["move", "merge"],
    whack: ["hit"],
    shooter: ["hit"],
    watermelon: ["drop", "merge"],
    fruitcut: ["collect"],
    gardenwatch: ["shoot", "rotate", "merge", "hit", "clear", "collect", "drop", "finish"],
    toydefense: ["shoot", "rotate", "merge", "hit", "clear", "collect", "drop", "finish"],
  };
  const gentleGames = ["toyblast","fruitgarden","icecream","pipes","tangram","market","robot","bento","shadow","patterns","memory","bridge","hanzi","mathtrain","englishisland","wordbuilder","sentencepost","bearclock","fairshare","englishshop"];
  const gentleEffects = ["move","rotate","drop","collect","clear","finish"];
  const buffers = new Map();
  const voices = new Set();
  const lastPlayed = new Map();
  const downloads = new Map();
  const failures = new Set();
  const soundButton = document.querySelector("#sound");
  let context, musicGain, effectGain, musicSource;
  let musicLevel = .10;
  let musicOffset = 0;
  let musicStarted = 0;
  let leaving = false;
  let paintedState;

  function status() {
    if (!isEnabled()) return "off";
    if (!(window.AudioContext || window.webkitAudioContext)) return "unsupported";
    if (!context || context.state !== "running") return "locked";
    if (!buffers.size) return failures.size ? "error" : "loading";
    return "on";
  }

  function paintStatus() {
    if (!soundButton) return;
    const state = status();
    if (state === paintedState) return;
    paintedState = state;
    const labels = { off: "声音关", locked: "开启声音", loading: "声音加载中", error: "重试声音", unsupported: "声音不可用", on: "声音开" };
    soundButton.textContent = labels[state];
    soundButton.dataset.audioState = state;
    soundButton.setAttribute("aria-pressed", String(state === "on"));
    soundButton.setAttribute("aria-label", state === "on" ? "关闭背景音乐和音效" : labels[state]);
  }

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
    paintStatus();
    if (!context) return;
    const allowed = audible();
    effectGain.gain.value = allowed ? .9 : 0;
    if (!allowed) {
      for (const voice of voices) voice.stop();
      voices.clear();
    }
    // Quiet ambience; effects always take priority, including rapid firing.
    const targetLevel = voices.size ? .025 : .10;
    if (targetLevel !== musicLevel) {
      musicLevel = targetLevel;
      musicGain.gain.cancelScheduledValues(context.currentTime);
      musicGain.gain.setTargetAtTime(targetLevel, context.currentTime, voices.size ? .015 : .18);
    }
    if (!music || !allowed || !isPlaying() || context.state !== "running") {
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

  function load(name, file) {
    if (buffers.has(name) || downloads.has(name)) return;
    const task = (async () => {
      try {
        const url = new URL(file, base);
        url.searchParams.set("v", "retro-1");
        const response = await fetch(url);
        if (!response.ok) throw new Error("Audio unavailable");
        buffers.set(name, await context.decodeAudioData(await response.arrayBuffer()));
        failures.delete(name);
      } catch (_) {
        failures.add(name);
      } finally {
        downloads.delete(name);
        sync();
      }
    })();
    downloads.set(name, task);
  }

  function prepare(retry = false) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || !isEnabled()) return;
    if (!context) {
      context = new AudioContext();
      musicGain = context.createGain();
      effectGain = context.createGain();
      musicGain.gain.value = musicLevel;
      effectGain.gain.value = .9;
      musicGain.connect(context.destination);
      effectGain.connect(context.destination);
      context.addEventListener("statechange", sync);
    }
    for (const name of [...effects, ...(music ? ["music"] : [])]) {
      if (!retry && failures.has(name)) continue;
      const folder = customEffects[game]?.includes(name) ? game + "/" : gentleGames.includes(game) && gentleEffects.includes(name) ? "feedback/" : "";
      load(name, name === "music" ? game + ".mp3" : folder + name + ".wav");
    }
  }

  function unlock(retry = false) {
    if (leaving || document.hidden || !isEnabled()) return;
    prepare(retry);
    if (!context) return;
    if (context.state !== "running") {
      context.resume().then(sync).catch(sync);
      // Starting a silent buffer within the gesture also unlocks older iOS audio.
      const silent = context.createBufferSource();
      silent.buffer = context.createBuffer(1, 1, context.sampleRate);
      silent.connect(context.destination);
      silent.onended = () => silent.disconnect();
      silent.start();
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
    source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); sync(); };
    source.start();
    sync();
  }

  // Listen after game handlers so a start/resume button has already changed state.
  for (const type of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) {
    document.addEventListener(type, event => {
      if (!event.isTrusted) return;
      // Let the sound button inspect the locked state before it resumes audio.
      // Otherwise pointerdown unlocks it and the following click mutes it again.
      if (event.target.closest?.("#sound")) return;
      unlock();
      queueMicrotask(sync);
    });
  }
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => { leaving = true; sync(); });
  window.addEventListener("pageshow", () => { leaving = false; sync(); });
  // Includes automatic game-over and pauses, without modifying physics loops.
  window.setInterval(sync, 100);
  // Decode before the first move, but never call resume outside a user gesture.
  queueMicrotask(() => { prepare(); sync(); });
  return {
    unlock, effect, sync,
    toggle() {
      // A locked or failed player needs enabling/retry, not an off/on cycle.
      return !isEnabled() || ["locked", "error"].includes(status());
    },
  };
};
