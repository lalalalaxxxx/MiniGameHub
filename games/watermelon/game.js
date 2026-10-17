"use strict";

const WORLD_W = 420;
const WORLD_H = 620;
const DROP_Y = 48;
const DANGER_Y = 116;
const FIXED_STEP = 1 / 120;
const BEST_KEY = "childgame.watermelon.best";
const SOUND_KEY = "childgame.sound";
const gameAudio = createGameAudio({
  game: "watermelon",
  isEnabled: () => soundOn,
  isPlaying: () => !paused && !gameOver,
  isPaused: () => paused,
});

const FRUITS = [
  { name: "莓莓果", radius: 17, color: "#ff8fb1", shade: "#f45d8a", points: 2 },
  { name: "蜜橘球", radius: 22, color: "#ffbd72", shade: "#f28a4b", points: 4 },
  { name: "青芽果", radius: 28, color: "#a9dc7b", shade: "#70bd68", points: 8 },
  { name: "桃桃云", radius: 34, color: "#ffb4b0", shade: "#f07f91", points: 16 },
  { name: "月亮梨", radius: 41, color: "#f5dc77", shade: "#d2bd54", points: 32 },
  { name: "蓝星果", radius: 49, color: "#8fcbe9", shade: "#649fd1", points: 64 },
  { name: "紫梦李", radius: 57, color: "#c3a3e8", shade: "#9573cc", points: 128 },
  { name: "彩虹柚", radius: 66, color: "#ff9e83", shade: "#ec6f62", points: 256 },
  { name: "太阳瓜", radius: 76, color: "#83d5a4", shade: "#55b586", points: 512 },
];

const canvas = document.querySelector("#board");
const boardWrap = document.querySelector("#boardWrap");
const ctx = canvas.getContext("2d");
const nextCanvas = document.querySelector("#next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const hintEl = document.querySelector("#hint");
const nextNameEl = document.querySelector("#nextName");
const pauseBtn = document.querySelector("#pause");
const restartBtn = document.querySelector("#restart");
const soundBtn = document.querySelector("#sound");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const againBtn = document.querySelector("#again");

let bodies = [];
let nextId = 1;
let nextLevel = 0;
let aimX = WORLD_W / 2;
let pointerId = null;
let score = 0;
let best = 0;
let paused = false;
let gameOver = false;
let soundOn = true;
let lastTime = 0;
let accumulator = 0;
let dangerTime = 0;
let lastDropAt = -1000;

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function loadBest() {
  try {
    return safeNumber(localStorage.getItem(BEST_KEY));
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

function saveScore() {
  if (score > best) {
    best = score;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (error) {
      /* 无痕浏览时仍可继续本局 */
    }
  }
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
}

function paintSoundButton() {
  gameAudio.sync();
}

function unlockAudio() {
  gameAudio.unlock();
}

function randomStarterLevel() {
  const roll = Math.random();
  if (roll < 0.52) return 0;
  if (roll < 0.84) return 1;
  return 2;
}

function makeBody(level, x, y, vx = 0, vy = 0) {
  return {
    id: nextId++,
    level,
    radius: FRUITS[level].radius,
    x,
    y,
    vx,
    vy,
    age: 0,
  };
}

function clampAim(x, level = nextLevel) {
  const radius = FRUITS[level].radius;
  return Math.max(radius + 3, Math.min(WORLD_W - radius - 3, x));
}

function updateNext() {
  aimX = clampAim(aimX);
  nextNameEl.textContent = FRUITS[nextLevel].name;
  nextCtx.clearRect(0, 0, 64, 64);
  const scale = Math.min(24 / FRUITS[nextLevel].radius, 1);
  drawFruit(nextCtx, 32, 33, FRUITS[nextLevel].radius * scale, nextLevel, 1);
}

function reset() {
  bodies = [];
  nextId = 1;
  nextLevel = randomStarterLevel();
  aimX = WORLD_W / 2;
  pointerId = null;
  score = 0;
  paused = false;
  gameOver = false;
  dangerTime = 0;
  accumulator = 0;
  lastTime = performance.now();
  lastDropAt = -1000;
  overlay.hidden = true;
  pauseBtn.textContent = "暂停";
  pauseBtn.disabled = false;
  hintEl.textContent = "在果篮顶部点击或拖动，松手投放";
  saveScore();
  updateNext();
  draw();
}

function dropFruit() {
  if (paused || gameOver || performance.now() - lastDropAt < 260) return;
  unlockAudio();
  const level = nextLevel;
  const x = clampAim(aimX, level);
  bodies.push(makeBody(level, x, DROP_Y));
  lastDropAt = performance.now();
  nextLevel = randomStarterLevel();
  aimX = clampAim(x);
  hintEl.textContent = "相同水果碰在一起，会长成更大的水果";
  gameAudio.effect("drop", { rate: 1 + level * .05 });
  updateNext();
}

function resolveBounds(body) {
  const restitution = 0.12;
  if (body.x - body.radius < 0) {
    body.x = body.radius;
    if (body.vx < 0) body.vx *= -restitution;
  } else if (body.x + body.radius > WORLD_W) {
    body.x = WORLD_W - body.radius;
    if (body.vx > 0) body.vx *= -restitution;
  }

  if (body.y + body.radius > WORLD_H) {
    body.y = WORLD_H - body.radius;
    if (body.vy > 0) body.vy *= -restitution;
    body.vx *= 0.94;
    if (Math.abs(body.vy) < 7) body.vy = 0;
    if (Math.abs(body.vx) < 1.5) body.vx = 0;
  }
}

function resolvePair(a, b, mergePairs, reserved) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let distanceSq = dx * dx + dy * dy;
  const minDistance = a.radius + b.radius;
  if (distanceSq >= minDistance * minDistance) return;

  if (distanceSq < 0.0001) {
    dx = a.id < b.id ? 0.01 : -0.01;
    dy = 0;
    distanceSq = dx * dx;
  }

  const distance = Math.sqrt(distanceSq);
  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minDistance - distance;
  const correction = Math.min(overlap * 0.52, 12);
  a.x -= nx * correction;
  a.y -= ny * correction;
  b.x += nx * correction;
  b.y += ny * correction;

  const relativeX = b.vx - a.vx;
  const relativeY = b.vy - a.vy;
  const normalSpeed = relativeX * nx + relativeY * ny;
  if (normalSpeed < 0) {
    const impulse = -(1.08 * normalSpeed) / 2;
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;

    const tx = -ny;
    const ty = nx;
    const tangentSpeed = relativeX * tx + relativeY * ty;
    const friction = Math.max(-impulse * 0.18, Math.min(impulse * 0.18, -tangentSpeed / 2));
    a.vx -= friction * tx;
    a.vy -= friction * ty;
    b.vx += friction * tx;
    b.vy += friction * ty;
  }

  if (
    a.level === b.level
    && a.level < FRUITS.length - 1
    && !reserved.has(a.id)
    && !reserved.has(b.id)
  ) {
    reserved.add(a.id);
    reserved.add(b.id);
    mergePairs.push([a, b]);
  }
}

function mergeBodies(mergePairs, reserved) {
  if (!mergePairs.length) return;
  const merged = [];

  mergePairs.forEach(([a, b]) => {
    const level = a.level + 1;
    const x = Math.max(
      FRUITS[level].radius,
      Math.min(WORLD_W - FRUITS[level].radius, (a.x + b.x) / 2),
    );
    const y = Math.min(WORLD_H - FRUITS[level].radius, (a.y + b.y) / 2);
    const vx = Math.max(-260, Math.min(260, (a.vx + b.vx) * 0.46));
    const vy = Math.max(-220, Math.min(180, (a.vy + b.vy) * 0.38 - 28));
    merged.push(makeBody(level, x, y, vx, vy));
    score += FRUITS[level].points;
    gameAudio.effect("merge", { rate: 1 + level * .06 });
  });

  bodies = bodies.filter((body) => !reserved.has(body.id));
  bodies.push(...merged);
  saveScore();
}

function physicsStep(dt) {
  const mergePairs = [];
  const reserved = new Set();

  bodies.forEach((body) => {
    body.age += dt;
    body.vy += 980 * dt;
    body.vx *= 0.999;
    body.vy *= 0.9995;
    body.vx = Math.max(-620, Math.min(620, body.vx));
    body.vy = Math.max(-760, Math.min(760, body.vy));
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    resolveBounds(body);
  });

  for (let iteration = 0; iteration < 5; iteration += 1) {
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        resolvePair(bodies[i], bodies[j], mergePairs, reserved);
      }
    }
    bodies.forEach(resolveBounds);
  }

  mergeBodies(mergePairs, reserved);

  const pileIsHigh = bodies.some((body) => (
    body.age > 0.85
    && body.y - body.radius < DANGER_Y
    && body.y > DROP_Y + 8
  ));
  dangerTime = pileIsHigh
    ? Math.min(2.4, dangerTime + dt)
    : Math.max(0, dangerTime - dt * 2.2);

  if (dangerTime >= 2.2) finishGame();
}

function finishGame() {
  if (gameOver) return;
  gameOver = true;
  pointerId = null;
  pauseBtn.disabled = true;
  saveScore();
  gameAudio.effect("over");
  hintEl.textContent = "果篮装满啦";
  overlayTitle.textContent = "果篮装满啦";
  overlayText.textContent = `这次得到 ${score} 分，最高纪录 ${best} 分。`;
  overlay.hidden = false;
  againBtn.focus();
}

function drawLeaf(target, x, y, radius, level) {
  target.save();
  target.translate(x, y - radius * 0.77);
  target.rotate(-0.42 + (level % 3) * 0.14);
  target.fillStyle = level === 8 ? "#427b5e" : "#65a76d";
  target.beginPath();
  target.ellipse(radius * 0.1, 0, radius * 0.34, radius * 0.16, 0, 0, Math.PI * 2);
  target.fill();
  target.restore();
}

function drawFruit(target, x, y, radius, level, alpha = 1) {
  const fruit = FRUITS[level];
  target.save();
  target.globalAlpha = alpha;
  target.shadowColor = "rgba(88, 57, 104, 0.18)";
  target.shadowBlur = Math.max(2, radius * 0.16);
  target.shadowOffsetY = Math.max(1, radius * 0.08);
  const gradient = target.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.4,
    radius * 0.08,
    x,
    y,
    radius,
  );
  gradient.addColorStop(0, "#fff8");
  gradient.addColorStop(0.28, fruit.color);
  gradient.addColorStop(1, fruit.shade);
  target.fillStyle = gradient;
  target.beginPath();
  target.arc(x, y, radius - 1, 0, Math.PI * 2);
  target.fill();
  target.shadowColor = "transparent";

  drawLeaf(target, x, y, radius, level);

  if (level === 0) {
    target.fillStyle = "#fff5";
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
      target.beginPath();
      target.arc(x + Math.cos(angle) * radius * 0.54, y + Math.sin(angle) * radius * 0.48, radius * 0.08, 0, Math.PI * 2);
      target.fill();
    }
  } else if (level === 1 || level === 7) {
    target.strokeStyle = "#fff5";
    target.lineWidth = Math.max(1.5, radius * 0.055);
    target.beginPath();
    target.arc(x, y, radius * 0.72, -0.8, 0.8);
    target.stroke();
  } else if (level === 5) {
    target.fillStyle = "#fff4";
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
      target.beginPath();
      target.arc(x + Math.cos(angle) * radius * 0.58, y + Math.sin(angle) * radius * 0.58, radius * 0.1, 0, Math.PI * 2);
      target.fill();
    }
  } else if (level === 8) {
    target.strokeStyle = "#dff7d9aa";
    target.lineWidth = Math.max(2, radius * 0.045);
    for (let offset = -0.45; offset <= 0.45; offset += 0.45) {
      target.beginPath();
      target.arc(x + offset * radius, y, radius * 0.72, 1.62, 4.66);
      target.stroke();
    }
  }

  const eyeY = y + radius * 0.03;
  const eyeGap = radius * 0.25;
  target.fillStyle = "#5c3d6e";
  target.beginPath();
  target.arc(x - eyeGap, eyeY, Math.max(1.8, radius * 0.055), 0, Math.PI * 2);
  target.arc(x + eyeGap, eyeY, Math.max(1.8, radius * 0.055), 0, Math.PI * 2);
  target.fill();
  target.strokeStyle = "#5c3d6e";
  target.lineWidth = Math.max(1.3, radius * 0.04);
  target.lineCap = "round";
  target.beginPath();
  target.arc(x, y + radius * 0.12, radius * 0.15, 0.18, Math.PI - 0.18);
  target.stroke();
  target.restore();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  sky.addColorStop(0, "#fff7ed");
  sky.addColorStop(0.5, "#fffaf5");
  sky.addColorStop(1, "#f8e9dc");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.fillStyle = "rgba(255,255,255,.38)";
  for (let y = 22; y < WORLD_H; y += 56) {
    for (let x = (y / 56) % 2 ? 25 : 53; x < WORLD_W; x += 84) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const warning = Math.min(1, dangerTime / 2.2);
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = warning > 0
    ? `rgba(239, 92, 112, ${0.55 + warning * 0.4})`
    : "rgba(208, 139, 157, 0.48)";
  ctx.beginPath();
  ctx.moveTo(10, DANGER_Y);
  ctx.lineTo(WORLD_W - 10, DANGER_Y);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = warning > 0 ? "#df6175" : "#b98a98";
  ctx.font = "700 13px ui-rounded, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(warning > 0 ? "快到危险线啦" : "危险线", 14, DANGER_Y - 9);

  ctx.strokeStyle = "rgba(169, 111, 100, .2)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(2.5, 0);
  ctx.lineTo(2.5, WORLD_H - 2.5);
  ctx.lineTo(WORLD_W - 2.5, WORLD_H - 2.5);
  ctx.lineTo(WORLD_W - 2.5, 0);
  ctx.stroke();
}

function draw() {
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  drawBackground();
  const ordered = [...bodies].sort((a, b) => a.radius - b.radius || a.id - b.id);
  ordered.forEach((body) => drawFruit(ctx, body.x, body.y, body.radius, body.level));

  if (!gameOver) {
    const radius = FRUITS[nextLevel].radius;
    ctx.save();
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = "rgba(119, 84, 129, .22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(aimX, DROP_Y + radius);
    ctx.lineTo(aimX, DANGER_Y - 6);
    ctx.stroke();
    ctx.restore();
    drawFruit(ctx, aimX, DROP_Y, radius, nextLevel, paused ? 0.35 : 0.72);
  }

  if (paused && !gameOver) {
    ctx.fillStyle = "rgba(92,61,110,.16)";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = "#5c3d6e";
    ctx.font = "800 28px ui-rounded, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("暂停中", WORLD_W / 2, WORLD_H / 2);
  }
}

function resizeCanvas() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width < 10 || height < 10) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bitmapWidth = Math.max(1, Math.round(width * dpr));
  const bitmapHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
    canvas.width = bitmapWidth;
    canvas.height = bitmapHeight;
  }
  ctx.setTransform(
    bitmapWidth / WORLD_W,
    0,
    0,
    bitmapHeight / WORLD_H,
    0,
    0,
  );
  draw();
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const frameTime = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (!paused && !gameOver) {
    accumulator = Math.min(accumulator + frameTime, FIXED_STEP * 8);
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 8) {
      physicsStep(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
      if (gameOver) break;
    }
  } else {
    accumulator = 0;
  }

  draw();
  requestAnimationFrame(loop);
}

function pointerWorldX(event) {
  const rect = canvas.getBoundingClientRect();
  return (event.clientX - rect.left) * WORLD_W / rect.width;
}

canvas.addEventListener("pointerdown", (event) => {
  if (paused || gameOver || pointerId !== null) return;
  event.preventDefault();
  unlockAudio();
  pointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  aimX = clampAim(pointerWorldX(event));
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== pointerId) return;
  event.preventDefault();
  aimX = clampAim(pointerWorldX(event));
});

canvas.addEventListener("pointerup", (event) => {
  if (event.pointerId !== pointerId) return;
  event.preventDefault();
  aimX = clampAim(pointerWorldX(event));
  pointerId = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  dropFruit();
});

canvas.addEventListener("pointercancel", (event) => {
  if (event.pointerId === pointerId) pointerId = null;
});

pauseBtn.addEventListener("click", () => {
  if (gameOver) return;
  unlockAudio();
  paused = !paused;
  pointerId = null;
  pauseBtn.textContent = paused ? "继续" : "暂停";
  hintEl.textContent = paused ? "暂停中" : "在果篮顶部点击或拖动，松手投放";
  lastTime = performance.now();
});

function restart() {
  unlockAudio();
  reset();
}

restartBtn.addEventListener("click", restart);
againBtn.addEventListener("click", restart);

soundBtn.addEventListener("click", () => {
  soundOn = gameAudio.toggle();
  if (soundOn) gameAudio.unlock(true);
  try {
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  } catch (error) {
    /* 本局仍可使用声音开关 */
  }
  paintSoundButton();
  if (soundOn) gameAudio.effect("start");
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden || paused || gameOver) return;
  paused = true;
  pointerId = null;
  pauseBtn.textContent = "继续";
  hintEl.textContent = "暂停中";
});

document.addEventListener("touchmove", (event) => {
  if (event.target.closest(".stage")) event.preventDefault();
}, { passive: false });

window.addEventListener("keydown", (event) => {
  if (event.key === " " && !gameOver) {
    event.preventDefault();
    pauseBtn.click();
  }
});

best = loadBest();
soundOn = loadSound();
paintSoundButton();
reset();
resizeCanvas();
new ResizeObserver(resizeCanvas).observe(boardWrap);
requestAnimationFrame(resizeCanvas);
requestAnimationFrame(loop);
