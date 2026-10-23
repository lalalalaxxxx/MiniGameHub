"use strict";

const WORLD = { width: 800, height: 1000 };
const BEST_KEY = "childgame.shooter.best";
const SOUND_KEY = "childgame.sound";
const gameAudio = createGameAudio({
  game: "shooter",
  isEnabled: () => soundOn,
  isPlaying: () => gameState === "playing",
  isPaused: () => gameState === "paused",
});
const PLAYER_RADIUS = 39;

const canvas = document.querySelector("#game");
const gameShell = document.querySelector("#gameShell");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const livesEl = document.querySelector("#lives");
const hintEl = document.querySelector("#hint");
const pauseBtn = document.querySelector("#pause");
const restartBtn = document.querySelector("#restart");
const soundBtn = document.querySelector("#sound");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const againBtn = document.querySelector("#again");

const player = { x: 400, y: 850, targetX: 400, targetY: 850, invincible: 0 };
const bullets = [];
const enemies = [];
const sparks = [];
const keys = new Set();
const skyDots = Array.from({ length: 52 }, (_, index) => ({
  x: (index * 173 + 47) % WORLD.width,
  y: (index * 257 + 83) % WORLD.height,
  radius: 1.5 + (index % 4) * 0.7,
  speed: 16 + (index % 7) * 6,
  phase: index * 0.73,
}));

let score = 0;
let best = loadNumber(BEST_KEY);
let lives = 3;
let gameState = "playing";
let elapsed = 0;
let fireTimer = 0;
let spawnTimer = 0.65;
let lastTime = performance.now();
let pointerId = null;
let pointerOrigin = null;
let touchControls = null;
const touchVector = { x: 0, y: 0 };
let soundOn = loadSound();

function loadNumber(key) {
  try {
    return Math.max(0, Number(localStorage.getItem(key)) || 0);
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

function saveBest() {
  if (score <= best) return;
  best = score;
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch (error) {
    /* The game still works when storage is unavailable. */
  }
}

function updateHud() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
  livesEl.textContent = `${"\u2665 ".repeat(lives)}${"\u2661 ".repeat(3 - lives)}`.trim();
  livesEl.setAttribute("aria-label", `\u5269\u4f59 ${lives} \u9897\u7231\u5fc3`);
}

function updateSoundButton() {
  gameAudio.sync();
}

function unlockAudio() {
  gameAudio.unlock();
}

function resetGame() {
  clearInput();
  score = 0;
  lives = 3;
  elapsed = 0;
  fireTimer = 0;
  spawnTimer = 0.7;
  bullets.length = 0;
  enemies.length = 0;
  sparks.length = 0;
  player.x = WORLD.width / 2;
  player.y = WORLD.height * 0.84;
  player.targetX = player.x;
  player.targetY = player.y;
  player.invincible = 0;
  gameState = "playing";
  lastTime = performance.now();
  pauseBtn.disabled = false;
  pauseBtn.textContent = "\u6682\u505c";
  hintEl.textContent = "按住摇杆飞行，自动发射；也可在画面任意处拖动";
  overlay.hidden = true;
  updateHud();
  syncTouch();
}

function finishGame() {
  clearInput();
  gameState = "over";
  const newRecord = score > best;
  saveBest();
  updateHud();
  pauseBtn.disabled = true;
  hintEl.textContent = "\u98de\u884c\u7ed3\u675f\uff0c\u4f11\u606f\u4e00\u4e0b\u5427";
  overlayTitle.textContent = newRecord ? "\u65b0\u7eaa\u5f55\uff01" : "\u98de\u884c\u7ed3\u675f";
  overlayText.textContent = `\u8fd9\u6b21\u6536\u96c6\u4e86 ${score} \u5206\uff0c\u518d\u98de\u4e00\u6b21\u4f1a\u66f4\u68d2\uff01`;
  overlay.hidden = false;
  gameAudio.effect("over");
  againBtn.focus();
  syncTouch();
}

function setPaused(paused) {
  if (gameState === "over") return;
  clearInput();
  gameState = paused ? "paused" : "playing";
  pauseBtn.textContent = paused ? "\u7ee7\u7eed" : "\u6682\u505c";
  hintEl.textContent = paused
    ? "\u6682\u505c\u4e2d\uff0c\u51c6\u5907\u597d\u518d\u7ee7\u7eed"
    : "按住摇杆飞行，自动发射；也可在画面任意处拖动";
  if (!paused) lastTime = performance.now();
  syncTouch();
}

function clampPlayer() {
  player.targetX = Math.max(PLAYER_RADIUS + 8, Math.min(WORLD.width - PLAYER_RADIUS - 8, player.targetX));
  player.targetY = Math.max(WORLD.height * 0.38, Math.min(WORLD.height - PLAYER_RADIUS - 12, player.targetY));
}

function moveTargetFromPointer(event) {
  if (!pointerOrigin) return;
  const rect = canvas.getBoundingClientRect();
  player.targetX = pointerOrigin.x + (event.clientX - pointerOrigin.clientX) / rect.width * WORLD.width;
  player.targetY = pointerOrigin.y + (event.clientY - pointerOrigin.clientY) / rect.height * WORLD.height;
  clampPlayer();
}

function fireStar() {
  bullets.push({ x: player.x, y: player.y - 48, speed: 680, rotation: 0 });
  gameAudio.effect("shoot", { volume: .55 });
}

function spawnEnemy() {
  const difficulty = Math.min(1, elapsed / 85 + score / 1600);
  const sturdy = difficulty > 0.25 && Math.random() < 0.18 + difficulty * 0.15;
  const radius = sturdy ? 47 : 34 + Math.random() * 9;
  enemies.push({
    x: radius + 18 + Math.random() * (WORLD.width - radius * 2 - 36),
    y: -radius - 12,
    radius,
    speed: 125 + Math.random() * 75 + difficulty * 180,
    drift: (Math.random() - 0.5) * (50 + difficulty * 55),
    wave: 1.4 + Math.random() * 1.8,
    phase: Math.random() * Math.PI * 2,
    hp: sturdy ? 2 : 1,
    sturdy,
  });
}

function burst(x, y, color, amount = 10) {
  for (let index = 0; index < amount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 180;
    sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.35,
      maxLife: 0.7,
      size: 4 + Math.random() * 7,
      color,
    });
  }
}

function hitPlayer(enemy) {
  enemy.dead = true;
  if (player.invincible > 0) return;
  lives -= 1;
  player.invincible = 1.8;
  burst(player.x, player.y, "#ff7da8", 18);
  gameAudio.effect("crash");
  if (lives <= 0) {
    finishGame();
  } else {
    hintEl.textContent = `\u8fd8\u6709 ${lives} \u9897\u7231\u5fc3\uff0c\u52a0\u6cb9\uff01`;
  }
  updateHud();
}

function update(dt) {
  elapsed += dt;
  player.invincible = Math.max(0, player.invincible - dt);

  const horizontal = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0) + touchVector.x;
  const vertical = (keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0) + touchVector.y;
  if (horizontal || vertical) {
    const length = Math.max(1, Math.hypot(horizontal, vertical));
    player.targetX += horizontal / length * 520 * dt;
    player.targetY += vertical / length * 520 * dt;
    clampPlayer();
  }

  const follow = 1 - Math.exp(-18 * dt);
  player.x += (player.targetX - player.x) * follow;
  player.y += (player.targetY - player.y) * follow;

  fireTimer -= dt;
  if (fireTimer <= 0) {
    fireStar();
    fireTimer += Math.max(0.17, 0.31 - elapsed * 0.0007);
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnEnemy();
    const difficulty = Math.min(1, elapsed / 90 + score / 1800);
    spawnTimer += Math.max(0.3, 0.9 - difficulty * 0.58) * (0.82 + Math.random() * 0.38);
  }

  bullets.forEach((bullet) => {
    bullet.y -= bullet.speed * dt;
    bullet.rotation += dt * 8;
    if (bullet.y < -30) bullet.dead = true;
  });

  enemies.forEach((enemy) => {
    enemy.y += enemy.speed * dt;
    enemy.x += Math.sin(elapsed * enemy.wave + enemy.phase) * enemy.drift * dt;
    enemy.x = Math.max(enemy.radius, Math.min(WORLD.width - enemy.radius, enemy.x));
    if (enemy.y > WORLD.height + enemy.radius) enemy.dead = true;

    const playerDistance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (!enemy.dead && playerDistance < enemy.radius * 0.72 + PLAYER_RADIUS * 0.72) {
      hitPlayer(enemy);
    }
  });

  for (const bullet of bullets) {
    if (bullet.dead) continue;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) > enemy.radius + 14) continue;
      bullet.dead = true;
      enemy.hp -= 1;
      burst(bullet.x, bullet.y, "#ffe472", 5);
      if (enemy.hp <= 0) {
        enemy.dead = true;
        score += enemy.sturdy ? 20 : 10;
        saveBest();
        updateHud();
        burst(enemy.x, enemy.y, enemy.sturdy ? "#cdb7ff" : "#82dcff", 12);
        gameAudio.effect("hit", { rate: enemy.sturdy ? .9 : 1.1, volume: .65 });
      }
      break;
    }
  }

  sparks.forEach((spark) => {
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.vx *= Math.pow(0.08, dt);
    spark.vy = spark.vy * Math.pow(0.18, dt) + 75 * dt;
    spark.life -= dt;
  });

  removeDead(bullets);
  removeDead(enemies);
  for (let index = sparks.length - 1; index >= 0; index -= 1) {
    if (sparks[index].life <= 0) sparks.splice(index, 1);
  }
}

function removeDead(items) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index].dead) items.splice(index, 1);
  }
}

function drawRoundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function starPath(x, y, outer, inner, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? outer : inner;
    const angle = rotation + point * Math.PI / 5;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (point === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  gradient.addColorStop(0, "#b9e8ff");
  gradient.addColorStop(0.55, "#d9ddff");
  gradient.addColorStop(1, "#ffe4f3");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  skyDots.forEach((dot) => {
    const y = (dot.y + elapsed * dot.speed) % (WORLD.height + 20) - 10;
    const glow = 0.45 + Math.sin(elapsed * 2 + dot.phase) * 0.2;
    ctx.globalAlpha = glow;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(dot.x, y, dot.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,255,255,.25)";
  ctx.beginPath();
  ctx.ellipse(105, 185, 110, 38, -0.1, 0, Math.PI * 2);
  ctx.ellipse(690, 370, 145, 48, 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawBullet(bullet) {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);
  ctx.rotate(bullet.rotation);
  ctx.shadowColor = "#fff3a5";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#fff170";
  starPath(0, 0, 16, 7);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const bob = Math.sin(elapsed * 5 + enemy.phase) * 3;
  ctx.translate(0, bob);

  ctx.fillStyle = "rgba(91,76,132,.16)";
  ctx.beginPath();
  ctx.ellipse(0, enemy.radius * 0.76, enemy.radius * 0.68, enemy.radius * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = enemy.sturdy ? "#ad98ec" : "#67c9ea";
  ctx.beginPath();
  ctx.arc(-enemy.radius * 0.38, 0, enemy.radius * 0.55, 0, Math.PI * 2);
  ctx.arc(enemy.radius * 0.32, -enemy.radius * 0.08, enemy.radius * 0.62, 0, Math.PI * 2);
  ctx.arc(0, enemy.radius * 0.27, enemy.radius * 0.68, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = enemy.sturdy ? "#d8caff" : "#a8e9f8";
  ctx.beginPath();
  ctx.arc(-enemy.radius * 0.18, -enemy.radius * 0.2, enemy.radius * 0.28, 0, Math.PI * 2);
  ctx.fill();

  const eyeY = enemy.radius * 0.08;
  [-0.24, 0.28].forEach((offset) => {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(enemy.radius * offset, eyeY, enemy.radius * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#514268";
    ctx.beginPath();
    ctx.arc(enemy.radius * offset, eyeY + 2, enemy.radius * 0.055, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = "#514268";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, enemy.radius * 0.29, enemy.radius * 0.13, 0.08, Math.PI - 0.08);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  if (player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0) {
    ctx.globalAlpha = 0.38;
  }
  ctx.save();
  ctx.translate(player.x, player.y);

  const flame = 24 + Math.sin(elapsed * 24) * 7;
  ctx.fillStyle = "#ffe472";
  ctx.beginPath();
  ctx.moveTo(-16, 34);
  ctx.quadraticCurveTo(0, 34 + flame, 16, 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ff9c86";
  ctx.beginPath();
  ctx.moveTo(-8, 34);
  ctx.quadraticCurveTo(0, 46 + flame * 0.45, 8, 34);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#a992ed";
  ctx.beginPath();
  ctx.moveTo(-30, 9);
  ctx.quadraticCurveTo(-62, 25, -70, 48);
  ctx.quadraticCurveTo(-34, 45, -14, 29);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(30, 9);
  ctx.quadraticCurveTo(62, 25, 70, 48);
  ctx.quadraticCurveTo(34, 45, 14, 29);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ff82b0";
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.bezierCurveTo(34, -36, 39, 12, 24, 45);
  ctx.quadraticCurveTo(0, 59, -24, 45);
  ctx.bezierCurveTo(-39, 12, -34, -36, 0, -58);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#dff8ff";
  ctx.beginPath();
  ctx.ellipse(0, -12, 21, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#514268";
  ctx.beginPath();
  ctx.arc(-7, -12, 3.5, 0, Math.PI * 2);
  ctx.arc(7, -12, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#514268";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -7, 7, 0.18, Math.PI - 0.18);
  ctx.stroke();

  ctx.fillStyle = "#fff";
  starPath(0, 26, 9, 4);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;

  if (player.invincible > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + Math.sin(elapsed * 10) * 0.15})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 58, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSparks() {
  sparks.forEach((spark) => {
    ctx.globalAlpha = Math.max(0, spark.life / spark.maxLife);
    ctx.fillStyle = spark.color;
    starPath(spark.x, spark.y, spark.size, spark.size * 0.45, elapsed * 4);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawPauseCard() {
  if (gameState !== "paused") return;
  ctx.fillStyle = "rgba(72,59,103,.26)";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = "rgba(255,255,255,.94)";
  drawRoundRect(210, 420, 380, 140, 34);
  ctx.fill();
  ctx.fillStyle = "#5c3d6e";
  ctx.font = '800 42px "Microsoft YaHei", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("\u6682\u505c\u4e2d", WORLD.width / 2, 478);
  ctx.font = '700 22px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = "#8a6d96";
  ctx.fillText("\u70b9\u201c\u7ee7\u7eed\u201d\u518d\u51fa\u53d1", WORLD.width / 2, 523);
}

function draw() {
  ctx.setTransform(canvas.width / WORLD.width, 0, 0, canvas.height / WORLD.height, 0, 0);
  drawSky();
  bullets.forEach(drawBullet);
  enemies.forEach(drawEnemy);
  drawSparks();
  drawPlayer();
  drawPauseCard();
}

function resizeCanvas() {
  const rect = gameShell.getBoundingClientRect();
  if (rect.width < 20 || rect.height < 20) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  draw();
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  if (gameState === "playing") update(dt);
  draw();
  requestAnimationFrame(frame);
}

canvas.addEventListener("pointerdown", (event) => {
  // Keep control with the first finger until it is released. Extra fingers
  // must never replace its ID or move the target to their contact position.
  if (gameState !== "playing" || pointerId !== null || touchVector.x || touchVector.y || !event.isPrimary || event.button !== 0) return;
  unlockAudio();
  pointerId = event.pointerId;
  pointerOrigin = { clientX: event.clientX, clientY: event.clientY, x: player.x, y: player.y };
  try { canvas.setPointerCapture(pointerId); } catch { /* A cancelled touch may already have ended. */ }
  player.targetX = player.x;
  player.targetY = player.y;
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== pointerId || gameState !== "playing") return;
  moveTargetFromPointer(event);
  event.preventDefault();
});

function clearPointer() {
  const previousId = pointerId;
  pointerId = null;
  pointerOrigin = null;
  player.targetX = player.x;
  player.targetY = player.y;
  if (previousId !== null && canvas.hasPointerCapture(previousId)) {
    canvas.releasePointerCapture(previousId);
  }
}

function clearInput() {
  keys.clear();
  touchVector.x = touchVector.y = 0;
  touchControls?.reset();
  clearPointer();
}

function releasePointer(event) {
  if (event.pointerId === pointerId) clearPointer();
}

canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);
canvas.addEventListener("lostpointercapture", releasePointer);

window.addEventListener("keydown", (event) => {
  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
    unlockAudio();
    keys.add(event.key);
  } else if (event.key === " " && gameState !== "over") {
    event.preventDefault();
    pauseBtn.click();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

window.addEventListener("blur", () => {
  clearInput();
  if (gameState === "playing") setPaused(true);
});

pauseBtn.addEventListener("click", () => {
  unlockAudio();
  setPaused(gameState === "playing");
});

function restart() {
  unlockAudio();
  resetGame();
}

restartBtn.addEventListener("click", restart);
againBtn.addEventListener("click", restart);

soundBtn.addEventListener("click", () => {
  soundOn = gameAudio.toggle();
  if (soundOn) gameAudio.unlock(true);
  try {
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  } catch (error) {
    /* Ignore storage errors in private browsing. */
  }
  updateSoundButton();
  if (soundOn) gameAudio.effect("start");
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && gameState === "playing") setPaused(true);
});

document.addEventListener("touchmove", (event) => {
  if (event.target.closest(".game-shell")) event.preventDefault();
}, { passive: false });

function syncTouch() {
  touchControls?.setEnabled(gameState !== "over");
  touchControls?.setActions([{ id: "pause", label: gameState === "paused" ? "继续" : "暂停", primary: true }]);
}
if (window.createTouchControls) {
  touchControls = createTouchControls({
    mount: document.querySelector("#touchDock"), axis: "free", label: "按住飞行",
    onMove: ({x, y}) => {
      if (gameState !== "playing" || pointerId !== null) { touchVector.x = touchVector.y = 0; return; }
      touchVector.x = x; touchVector.y = y;
      if (x || y) unlockAudio();
      else { player.targetX = player.x; player.targetY = player.y; }
    },
    onAction: (id, pressed) => { if (id === "pause" && pressed) pauseBtn.click(); },
  });
  document.body.classList.add("touch-ready");
}

bestEl.textContent = String(best);
updateSoundButton();
resetGame();
resizeCanvas();
if ("ResizeObserver" in window) {
  new ResizeObserver(resizeCanvas).observe(gameShell);
} else {
  window.addEventListener("resize", resizeCanvas);
}
requestAnimationFrame(resizeCanvas);
requestAnimationFrame(frame);
