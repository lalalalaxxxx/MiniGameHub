"use strict";

const GAME_LENGTH = 45000;
const BEST_KEY = "childgame.whack.best";
const SOUND_KEY = "childgame.sound";
const gameAudio = createGameAudio({
  game: "whack",
  isEnabled: () => soundOn,
  isPlaying: () => state === "running",
  isPaused: () => state === "paused",
});

const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const timeEl = document.querySelector("#time");
const hintEl = document.querySelector("#hint");
const comboEl = document.querySelector("#combo");
const pauseBtn = document.querySelector("#pause");
const restartBtn = document.querySelector("#restart");
const soundBtn = document.querySelector("#sound");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const mainAction = document.querySelector("#mainAction");
const holes = [...document.querySelectorAll(".hole")];

let state = "idle";
let score = 0;
let best = loadNumber(BEST_KEY);
let combo = 0;
let endAt = 0;
let pausedAt = 0;
let shownSecond = 45;
let spawnTimer = 0;
let active = null;
let previousHole = -1;
let soundOn = loadSound();

function loadNumber(key) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch (error) {
    return 0;
  }
}

function loadSound() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch (error) {
    return true;
  }
}

function saveValue(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (error) {
    /* 无痕模式可能无法保存，但不影响当前游戏 */
  }
}

function unlockAudio() {
  gameAudio.unlock();
}

function paintSound() {
  gameAudio.sync();
}

function paintScore() {
  if (score > best) {
    best = score;
    saveValue(BEST_KEY, best);
  }
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
}

function paintCombo() {
  if (combo < 2) {
    comboEl.hidden = true;
    return;
  }
  comboEl.hidden = false;
  comboEl.querySelector("strong").textContent = String(combo);
  comboEl.style.animation = "none";
  void comboEl.offsetWidth;
  comboEl.style.animation = "";
}

function setHint(message) {
  hintEl.textContent = message;
  hintEl.classList.remove("pop");
  void hintEl.offsetWidth;
  hintEl.classList.add("pop");
}

function showOverlay(title, text, buttonText) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  mainAction.textContent = buttonText;
  overlay.hidden = false;
}

function hideActive() {
  if (!active) return;
  const hole = holes[active.index];
  hole.classList.remove("show", "mole", "spike", "bomb");
  hole.setAttribute("aria-label", "空洞");
  active = null;
}

function clearSpawnTimer() {
  window.clearTimeout(spawnTimer);
  spawnTimer = 0;
}

function difficulty() {
  if (state !== "running") return 0;
  const remaining = Math.max(0, endAt - performance.now());
  return Math.min(1, Math.max(0, 1 - remaining / GAME_LENGTH));
}

function scheduleSpawn(delay) {
  clearSpawnTimer();
  if (state !== "running") return;
  spawnTimer = window.setTimeout(showTarget, delay);
}

function chooseHole() {
  let index = Math.floor(Math.random() * holes.length);
  if (index === previousHole) {
    index = (index + 1 + Math.floor(Math.random() * (holes.length - 1))) % holes.length;
  }
  previousHole = index;
  return index;
}

function showTarget() {
  if (state !== "running") return;
  hideActive();

  const progress = difficulty();
  const hazardChance = 0.14 + progress * 0.1;
  let type = "mole";
  if (Math.random() < hazardChance) type = Math.random() < 0.58 ? "spike" : "bomb";

  const index = chooseHole();
  const hole = holes[index];
  const visibleFor = Math.round(730 - progress * 330);
  active = { index, type };
  hole.classList.add(type);
  hole.setAttribute(
    "aria-label",
    type === "mole" ? "圆脸小地鼠，快点它" : type === "spike" ? "粉色小刺球，不要点" : "小炸弹，不要点",
  );
  requestAnimationFrame(() => {
    if (active && active.index === index) hole.classList.add("show");
  });

  spawnTimer = window.setTimeout(() => {
    if (!active || active.index !== index || state !== "running") return;
    const missedMole = active.type === "mole";
    hideActive();
    if (missedMole && combo > 0) {
      combo = 0;
      paintCombo();
      setHint("差一点，下一只加油！");
    }
    scheduleSpawn(Math.round(190 - progress * 100));
  }, visibleFor);
}

function markHit(hole, className) {
  hole.classList.remove("hit-good", "hit-bad");
  void hole.offsetWidth;
  hole.classList.add(className);
  window.setTimeout(() => hole.classList.remove(className), 320);
}

function hitTarget(index) {
  if (state !== "running" || !active || active.index !== index) return;
  unlockAudio();
  clearSpawnTimer();

  const type = active.type;
  const hole = holes[index];
  hideActive();

  if (type === "mole") {
    combo += 1;
    const points = 1 + Math.floor(combo / 5);
    score += points;
    paintScore();
    paintCombo();
    markHit(hole, "hit-good");
    setHint(combo >= 2 ? `漂亮！${combo} 连击` : "打中啦！");
    gameAudio.effect("hit", { rate: 1 + Math.min(combo, 8) * .04 });
    if (combo > 0 && combo % 5 === 0) gameAudio.effect("collect");
  } else {
    const lost = Math.min(2, score);
    score -= lost;
    combo = 0;
    paintScore();
    paintCombo();
    markHit(hole, "hit-bad");
    setHint(lost ? `这个不能点，扣 ${lost} 分` : "这个不能点哦");
    gameAudio.effect("crash");
  }

  scheduleSpawn(Math.round(145 - difficulty() * 65));
}

function startGame() {
  unlockAudio();
  clearSpawnTimer();
  hideActive();
  state = "running";
  score = 0;
  combo = 0;
  shownSecond = 45;
  endAt = performance.now() + GAME_LENGTH;
  previousHole = -1;
  scoreEl.textContent = "0";
  timeEl.textContent = "45";
  paintCombo();
  pauseBtn.disabled = false;
  pauseBtn.textContent = "暂停";
  overlay.hidden = true;
  setHint("只点圆脸小地鼠，粉色刺球和炸弹不要点");
  scheduleSpawn(300);
  gameAudio.effect("start");
}

function pauseGame(automatic = false) {
  if (state !== "running") return;
  clearSpawnTimer();
  hideActive();
  state = "paused";
  pausedAt = performance.now();
  pauseBtn.textContent = "继续";
  setHint("暂停中");
  showOverlay(
    automatic ? "自动暂停啦" : "休息一下",
    automatic ? "页面藏起来时，游戏会帮你停住计时。" : "准备好了再继续，剩余时间已经停住。",
    "继续游戏",
  );
}

function resumeGame() {
  if (state !== "paused") return;
  unlockAudio();
  endAt += performance.now() - pausedAt;
  state = "running";
  pauseBtn.textContent = "暂停";
  overlay.hidden = true;
  setHint("继续！找圆脸小地鼠");
  scheduleSpawn(220);
  gameAudio.effect("start");
}

function finishGame() {
  if (state !== "running") return;
  clearSpawnTimer();
  hideActive();
  state = "ended";
  timeEl.textContent = "0";
  pauseBtn.disabled = true;
  pauseBtn.textContent = "暂停";
  combo = 0;
  paintCombo();
  paintScore();
  setHint("时间到！");
  const message = score === 0
    ? "先认准圆脸小地鼠，再试一次吧！"
    : score < 12
      ? `你拿到 ${score} 分，再来一局会更快！`
      : `你拿到 ${score} 分，眼睛和小手配合得真棒！`;
  showOverlay("时间到啦", message, "再玩一局");
  gameAudio.effect("finish");
}

function updateClock(now) {
  if (state !== "running") return;
  const remaining = Math.max(0, endAt - now);
  const second = Math.ceil(remaining / 1000);
  if (second !== shownSecond) {
    shownSecond = second;
    timeEl.textContent = String(second);
  }
  if (remaining <= 0) finishGame();
}

function loop(now) {
  updateClock(now);
  requestAnimationFrame(loop);
}

holes.forEach((hole, index) => {
  hole.addEventListener("click", () => hitTarget(index));
});

mainAction.addEventListener("click", () => {
  if (state === "paused") resumeGame();
  else startGame();
});

pauseBtn.addEventListener("click", () => {
  if (state === "running") pauseGame();
  else if (state === "paused") resumeGame();
});

restartBtn.addEventListener("click", startGame);

soundBtn.addEventListener("click", () => {
  soundOn = gameAudio.toggle();
  if (soundOn) gameAudio.unlock(true);
  saveValue(SOUND_KEY, soundOn ? "on" : "off");
  paintSound();
  if (soundOn) gameAudio.effect("start");
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame(true);
});

document.addEventListener("touchmove", (event) => {
  if (event.target.closest(".stage")) event.preventDefault();
}, { passive: false });

bestEl.textContent = String(best);
paintSound();
requestAnimationFrame(loop);
