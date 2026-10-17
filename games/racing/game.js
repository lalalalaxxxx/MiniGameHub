"use strict";

const BEST_KEY = "childgame.racing.best";
const SOUND_KEY = "childgame.sound";
const gameAudio = createGameAudio({
  game: "racing",
  isEnabled: () => soundOn,
  isPlaying: () => !paused && !gameOver,
  isPaused: () => paused,
});
const WORLD = { width: 720, height: 960 };
const ROAD = { left: 86, right: 634, width: 548 };
const LANES = 4;
const PLAYER_Y = 792;
const PLAYER_SIZE = { width: 82, height: 132 };
const INVINCIBLE_TIME = 1.65;
const COLORS = ["#77cbed", "#ffd369", "#9c8ee8", "#72d6a0", "#f29ab5"];

const canvas = document.querySelector("#game");
const roadWrap = document.querySelector("#roadWrap");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const heartsEl = document.querySelector("#hearts");
const heartEls = [...heartsEl.querySelectorAll("span")];
const hintEl = document.querySelector("#hint");
const pauseBtn = document.querySelector("#pause");
const restartBtn = document.querySelector("#restart");
const soundBtn = document.querySelector("#sound");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const againBtn = document.querySelector("#again");

let best = loadNumber(BEST_KEY);
let soundOn = loadSound();
let obstacles = [];
let player = { x: laneCenter(1), targetX: laneCenter(1) };
let distance = 0;
let speed = 270;
let hearts = 3;
let roadOffset = 0;
let sceneryOffset = 0;
let spawnClock = 0;
let spawnDelay = 1.05;
let invincible = 0;
let lastTime = 0;
let paused = false;
let gameOver = false;
let shownScore = -1;
let newRecord = false;

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

function storeBest() {
  const score = Math.floor(distance);
  if (score <= best) return;
  best = score;
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch (error) {
    /* 存储被关闭时，不影响这一局继续玩 */
  }
}

function laneCenter(lane) {
  return ROAD.left + ROAD.width * (lane + 0.5) / LANES;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateScore(force = false) {
  const score = Math.floor(distance);
  if (!force && score === shownScore) return;
  shownScore = score;
  if (score > best) {
    best = score;
    newRecord = true;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (error) {
      /* 存储不可用时，最高分仍会保留到本页面关闭 */
    }
  }
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
}

function updateHearts() {
  heartEls.forEach((heart, index) => {
    heart.classList.toggle("lost", index >= hearts);
  });
  heartsEl.setAttribute("aria-label", `还有 ${hearts} 颗爱心`);
}

function paintSound() {
  gameAudio.sync();
}

function unlockAudio() {
  gameAudio.unlock();
}

function movePlayer(direction) {
  if (gameOver || paused) return;
  unlockAudio();
  const nearestLane = clamp(
    Math.round((player.targetX - ROAD.left) / (ROAD.width / LANES) - 0.5),
    0,
    LANES - 1,
  );
  const nextLane = clamp(nearestLane + direction, 0, LANES - 1);
  player.targetX = laneCenter(nextLane);
  hintEl.textContent = "看准空车道，继续向前！";
  gameAudio.effect("move", { volume: .55 });
}

function chooseLane(excluded = []) {
  const choices = [];
  for (let lane = 0; lane < LANES; lane += 1) {
    if (!excluded.includes(lane)) choices.push(lane);
  }
  return choices[Math.floor(Math.random() * choices.length)];
}

function addObstacle(lane, y = -100) {
  const barrier = Math.random() < 0.25;
  obstacles.push({
    lane,
    x: laneCenter(lane),
    y,
    width: barrier ? 104 : 78,
    height: barrier ? 66 : 126,
    kind: barrier ? "barrier" : "car",
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    extraSpeed: Math.random() * 34,
    wobble: Math.random() * Math.PI * 2,
  });
}

function spawnObstacles() {
  const firstLane = chooseLane();
  addObstacle(firstLane);

  const difficulty = clamp(distance / 650, 0, 1);
  if (Math.random() < 0.12 + difficulty * 0.28) {
    const secondLane = chooseLane([firstLane]);
    addObstacle(secondLane, -120 - Math.random() * 40);
  }

  const baseDelay = 1.12 - difficulty * 0.47;
  spawnDelay = baseDelay + Math.random() * 0.28;
}

function intersects(obstacle) {
  const playerBox = {
    left: player.x - PLAYER_SIZE.width * 0.34,
    right: player.x + PLAYER_SIZE.width * 0.34,
    top: PLAYER_Y - PLAYER_SIZE.height * 0.39,
    bottom: PLAYER_Y + PLAYER_SIZE.height * 0.42,
  };
  const obstacleBox = {
    left: obstacle.x - obstacle.width * 0.36,
    right: obstacle.x + obstacle.width * 0.36,
    top: obstacle.y - obstacle.height * 0.4,
    bottom: obstacle.y + obstacle.height * 0.4,
  };
  return playerBox.left < obstacleBox.right
    && playerBox.right > obstacleBox.left
    && playerBox.top < obstacleBox.bottom
    && playerBox.bottom > obstacleBox.top;
}

function hitObstacle(obstacle) {
  hearts -= 1;
  invincible = INVINCIBLE_TIME;
  obstacle.remove = true;
  updateHearts();
  gameAudio.effect("crash");

  if (hearts <= 0) {
    finishGame();
    return;
  }
  hintEl.textContent = `小心！还剩 ${hearts} 颗爱心`;
}

function update(delta) {
  if (paused || gameOver) return;

  distance += speed * delta * 0.035;
  speed = Math.min(535, 270 + distance * 0.42);
  roadOffset = (roadOffset + speed * delta) % 180;
  sceneryOffset = (sceneryOffset + speed * delta * 0.72) % 260;
  invincible = Math.max(0, invincible - delta);
  player.x += (player.targetX - player.x) * Math.min(1, delta * 12);

  spawnClock += delta;
  if (spawnClock >= spawnDelay) {
    spawnClock -= spawnDelay;
    spawnObstacles();
  }

  for (const obstacle of obstacles) {
    obstacle.y += (speed + obstacle.extraSpeed) * delta;
    obstacle.wobble += delta * 2;
    if (obstacle.y > WORLD.height + 120) obstacle.remove = true;
    if (!obstacle.remove && invincible <= 0 && intersects(obstacle)) {
      hitObstacle(obstacle);
    }
  }
  obstacles = obstacles.filter((obstacle) => !obstacle.remove);
  updateScore();
}

function resetGame() {
  obstacles = [];
  player = { x: laneCenter(1), targetX: laneCenter(1) };
  distance = 0;
  speed = 270;
  hearts = 3;
  roadOffset = 0;
  sceneryOffset = 0;
  spawnClock = 0;
  spawnDelay = 0.85;
  invincible = 0;
  paused = false;
  gameOver = false;
  shownScore = -1;
  newRecord = false;
  lastTime = performance.now();
  overlay.hidden = true;
  pauseBtn.disabled = false;
  pauseBtn.textContent = "暂停";
  hintEl.textContent = "向左或向右滑动，切换车道";
  updateHearts();
  updateScore(true);
  draw();
}

function finishGame() {
  gameOver = true;
  paused = false;
  pauseBtn.disabled = true;
  storeBest();
  updateScore(true);
  hintEl.textContent = "这一圈跑完啦！";
  overlayTitle.textContent = newRecord ? "新的最高纪录！" : "到达终点啦";
  overlayText.textContent = `你跑了 ${Math.floor(distance)} 米，再来挑战一次吧！`;
  overlay.hidden = false;
  gameAudio.effect("finish");
  againBtn.focus();
}

function setPaused(next, message = true) {
  if (gameOver) return;
  paused = next;
  pauseBtn.textContent = paused ? "继续" : "暂停";
  if (message) hintEl.textContent = paused ? "休息一下，准备好再继续" : "看准空车道，继续向前！";
  lastTime = performance.now();
  draw();
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawScenery() {
  ctx.fillStyle = "#bce7c5";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  for (let y = -220 + sceneryOffset; y < WORLD.height + 180; y += 260) {
    drawTree(38, y, 0.92);
    drawTree(680, y + 122, 0.74);
    drawFlower(42, y + 118, "#fff59b");
    drawFlower(671, y + 224, "#ffb4d1");
  }
}

function drawTree(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#a77b58";
  roundedRect(ctx, -7, 20, 14, 42, 7);
  ctx.fill();
  ctx.fillStyle = "#72ca91";
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.arc(-18, 15, 20, 0, Math.PI * 2);
  ctx.arc(18, 16, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.beginPath();
  ctx.arc(-9, -8, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFlower(x, y, color) {
  ctx.fillStyle = color;
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 7, y + Math.sin(angle) * 7, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f5a44e";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoad() {
  ctx.fillStyle = "#fff2c2";
  ctx.fillRect(ROAD.left - 13, 0, ROAD.width + 26, WORLD.height);
  ctx.fillStyle = "#74798b";
  ctx.fillRect(ROAD.left, 0, ROAD.width, WORLD.height);

  const edgeStripe = 48;
  for (let y = roadOffset - edgeStripe * 2; y < WORLD.height; y += edgeStripe * 2) {
    ctx.fillStyle = "#f8a4b8";
    ctx.fillRect(ROAD.left, y, 13, edgeStripe);
    ctx.fillRect(ROAD.right - 13, y, 13, edgeStripe);
    ctx.fillStyle = "#fffaf5";
    ctx.fillRect(ROAD.left, y + edgeStripe, 13, edgeStripe);
    ctx.fillRect(ROAD.right - 13, y + edgeStripe, 13, edgeStripe);
  }

  ctx.fillStyle = "rgba(255,255,255,.74)";
  for (let lane = 1; lane < LANES; lane += 1) {
    const x = ROAD.left + ROAD.width * lane / LANES;
    for (let y = roadOffset - 180; y < WORLD.height; y += 180) {
      roundedRect(ctx, x - 5, y, 10, 92, 5);
      ctx.fill();
    }
  }
}

function drawCar(x, y, width, height, color, facingDown = false, playerCar = false) {
  ctx.save();
  ctx.translate(x, y);
  if (facingDown) ctx.rotate(Math.PI);

  ctx.fillStyle = "rgba(60,52,78,.2)";
  roundedRect(ctx, -width * 0.47 + 5, -height * 0.47 + 8, width * 0.94, height * 0.94, width * 0.28);
  ctx.fill();

  ctx.fillStyle = "#53566a";
  roundedRect(ctx, -width * 0.56, -height * 0.3, width * 0.16, height * 0.24, 6);
  ctx.fill();
  roundedRect(ctx, width * 0.4, -height * 0.3, width * 0.16, height * 0.24, 6);
  ctx.fill();
  roundedRect(ctx, -width * 0.56, height * 0.12, width * 0.16, height * 0.24, 6);
  ctx.fill();
  roundedRect(ctx, width * 0.4, height * 0.12, width * 0.16, height * 0.24, 6);
  ctx.fill();

  ctx.fillStyle = color;
  roundedRect(ctx, -width / 2, -height / 2, width, height, width * 0.28);
  ctx.fill();

  ctx.fillStyle = playerCar ? "#ffe0ee" : "#dff5ff";
  roundedRect(ctx, -width * 0.34, -height * 0.22, width * 0.68, height * 0.32, width * 0.13);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.75)";
  roundedRect(ctx, -width * 0.27, -height * 0.17, width * 0.19, height * 0.2, 5);
  ctx.fill();

  ctx.fillStyle = "#fff8a8";
  ctx.beginPath();
  ctx.arc(-width * 0.28, -height * 0.38, width * 0.09, 0, Math.PI * 2);
  ctx.arc(width * 0.28, -height * 0.38, width * 0.09, 0, Math.PI * 2);
  ctx.fill();

  if (playerCar) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-width * 0.17, height * 0.28, width * 0.08, 0, Math.PI * 2);
    ctx.arc(width * 0.17, height * 0.28, width * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5c3d6e";
    ctx.beginPath();
    ctx.arc(-width * 0.17, height * 0.28, width * 0.035, 0, Math.PI * 2);
    ctx.arc(width * 0.17, height * 0.28, width * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBarrier(obstacle) {
  const { x, y, width, height } = obstacle;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(60,52,78,.18)";
  roundedRect(ctx, -width / 2 + 5, -height / 2 + 7, width, height, 12);
  ctx.fill();
  ctx.fillStyle = "#fff7ed";
  roundedRect(ctx, -width / 2, -height / 2, width, height, 12);
  ctx.fill();
  ctx.save();
  roundedRect(ctx, -width / 2, -height / 2, width, height, 12);
  ctx.clip();
  ctx.strokeStyle = "#ff9b72";
  ctx.lineWidth = 20;
  for (let stripe = -width; stripe < width * 1.5; stripe += 40) {
    ctx.beginPath();
    ctx.moveTo(stripe, height / 2);
    ctx.lineTo(stripe + height, -height / 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#7c6687";
  roundedRect(ctx, -width * 0.4, height * 0.42, 13, 25, 5);
  ctx.fill();
  roundedRect(ctx, width * 0.4 - 13, height * 0.42, 13, 25, 5);
  ctx.fill();
  ctx.restore();
}

function drawSpeedLines() {
  const intensity = clamp((speed - 270) / 265, 0, 1);
  if (intensity < 0.08) return;
  ctx.strokeStyle = `rgba(255,255,255,${0.08 + intensity * 0.16})`;
  ctx.lineWidth = 4;
  for (let index = 0; index < 7; index += 1) {
    const x = ROAD.left + 30 + ((index * 83 + Math.floor(distance * 7)) % (ROAD.width - 60));
    const y = (index * 157 + roadOffset * 2) % WORLD.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 34 + intensity * 42);
    ctx.stroke();
  }
}

function drawPausedCard() {
  if (!paused || gameOver) return;
  ctx.fillStyle = "rgba(73, 62, 92, .28)";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = "rgba(255,255,255,.95)";
  roundedRect(ctx, 180, 402, 360, 156, 34);
  ctx.fill();
  ctx.fillStyle = "#5c3d6e";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 45px ui-rounded, sans-serif";
  ctx.fillText("休息一下", WORLD.width / 2, 462);
  ctx.fillStyle = "#8a6d96";
  ctx.font = "700 24px ui-rounded, sans-serif";
  ctx.fillText("点“继续”回到赛道", WORLD.width / 2, 512);
}

function draw() {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  drawScenery();
  drawRoad();
  drawSpeedLines();

  for (const obstacle of obstacles) {
    if (obstacle.kind === "barrier") {
      drawBarrier(obstacle);
    } else {
      drawCar(obstacle.x, obstacle.y, obstacle.width, obstacle.height, obstacle.color, true);
    }
  }

  const visible = invincible <= 0 || Math.floor(invincible * 11) % 2 === 0;
  if (visible) {
    drawCar(player.x, PLAYER_Y, PLAYER_SIZE.width, PLAYER_SIZE.height, "#ff78a8", false, true);
  }
  drawPausedCard();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(
    canvas.width / WORLD.width,
    0,
    0,
    canvas.height / WORLD.height,
    0,
    0,
  );
  draw();
}

function frame(timestamp) {
  const delta = Math.min(0.05, Math.max(0, (timestamp - lastTime) / 1000));
  lastTime = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

document.querySelectorAll(".steer").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.classList.add("is-down");
    movePlayer(Number(button.dataset.move));
  });
  const release = () => button.classList.remove("is-down");
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

bindSwipe(document.querySelector(".stage"), {
  onInteract: unlockAudio,
  enabled: () => !paused && !gameOver,
  onDirection: (direction) => {
    if (direction === "left" || direction === "right") movePlayer(direction === "left" ? -1 : 1);
  },
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    event.preventDefault();
    movePlayer(-1);
  } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    event.preventDefault();
    movePlayer(1);
  } else if (event.key === " " && !gameOver) {
    event.preventDefault();
    setPaused(!paused);
  } else if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    resetGame();
  }
});

pauseBtn.addEventListener("click", () => {
  unlockAudio();
  setPaused(!paused);
});

restartBtn.addEventListener("click", () => {
  unlockAudio();
  resetGame();
});

againBtn.addEventListener("click", () => {
  unlockAudio();
  resetGame();
});

soundBtn.addEventListener("click", () => {
  soundOn = gameAudio.toggle();
  if (soundOn) gameAudio.unlock(true);
  try {
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  } catch (error) {
    /* 无痕模式无法保存时，仅保持当前页面的设置 */
  }
  paintSound();
  if (soundOn) gameAudio.effect("start");
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && !paused && !gameOver) {
    setPaused(true, false);
    hintEl.textContent = "页面离开时已自动暂停";
  }
});

bestEl.textContent = String(best);
paintSound();
resetGame();
resizeCanvas();
new ResizeObserver(resizeCanvas).observe(roadWrap);
window.addEventListener("resize", resizeCanvas);
requestAnimationFrame((timestamp) => {
  lastTime = timestamp;
  requestAnimationFrame(frame);
});
