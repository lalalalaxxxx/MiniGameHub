const COLS = 12;
const BEST_KEY = "childgame.snake.best";
const SOUND_KEY = "childgame.sound";
const gameAudio = createGameAudio({
  game: "snake",
  isEnabled: () => soundOn,
  isPlaying: () => running && !paused && !over,
  isPaused: () => paused,
});
const HEAD_RADIUS = 0.34;
const FOOD_RADIUS = 0.26;
const EAT_PADDING = 0.08;
const BODY_HIT_DISTANCE = 0.58;

const canvas = document.querySelector("#board");
const boardWrap = document.querySelector("#boardWrap");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const hintEl = document.querySelector("#hint");
const pauseBtn = document.querySelector("#pause");
const restartBtn = document.querySelector("#restart");
const soundBtn = document.querySelector("#sound");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const againBtn = document.querySelector("#again");

const snake = [];
let dir = { x: 1, y: 0 };
let queuedDir = null;
let food = null;
let score = 0;
let best = 0;
let speed = 3.5;
let running = false;
let paused = false;
let over = false;
let lastTs = 0;
let cell = 0;
let soundOn = true;
let touchControls = null;
let padPointer = null;

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
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

function paintSound() {
  gameAudio.sync();
}

function unlock() {
  gameAudio.unlock();
}

function remember() {
  if (score > best) {
    best = score;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (error) {
      /* 无痕模式可能写不进去，这一局仍然照常玩 */
    }
  }
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
}

function placeFood() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = {
      x: 0.7 + Math.random() * (COLS - 1.4),
      y: 0.7 + Math.random() * (COLS - 1.4),
    };
    const clear = snake.every((part) => Math.hypot(part.x - candidate.x, part.y - candidate.y) > 1.2);
    if (clear) {
      food = candidate;
      return;
    }
  }
  food = { x: 1, y: 1 };
}

function reset() {
  clearControls();
  snake.splice(
    0,
    snake.length,
    { x: 6.2, y: 6 },
    { x: 5.45, y: 6 },
    { x: 4.7, y: 6 },
    { x: 3.95, y: 6 },
  );
  dir = { x: 1, y: 0 };
  queuedDir = null;
  score = 0;
  speed = 3.5;
  running = false;
  paused = false;
  over = false;
  lastTs = performance.now();
  pauseBtn.disabled = true;
  pauseBtn.textContent = "暂停";
  hintEl.textContent = "推摇杆转弯，也可以在棋盘上滑动";
  overlay.hidden = true;
  placeFood();
  remember();
  draw();
  syncTouch();
}

function finish(title, text) {
  clearControls();
  over = true;
  running = false;
  pauseBtn.disabled = true;
  hintEl.textContent = title;
  remember();
  gameAudio.effect("over");
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.hidden = false;
  againBtn.focus();
  draw();
  syncTouch();
}

function setDir(x, y) {
  unlock();
  if (over || paused) return;
  if (dir.x === -x && dir.y === -y) {
    if (!running) hintEl.textContent = "这个方向会回头咬到自己";
    return;
  }
  queuedDir = { x, y };
  if (!running) {
    running = true;
    pauseBtn.disabled = false;
    hintEl.textContent = "吃到粉色果子就会变长";
    lastTs = performance.now();
    syncTouch();
  }
}

function update(dt) {
  if (!running || paused || over) return;
  if (queuedDir) {
    dir = queuedDir;
    queuedDir = null;
  }
  const head = snake[0];
  const distance = speed * dt / 1000;
  head.x += dir.x * distance;
  head.y += dir.y * distance;

  const edge = HEAD_RADIUS;
  if (head.x < edge || head.y < edge || head.x > COLS - edge || head.y > COLS - edge) {
    head.x = Math.max(edge, Math.min(COLS - edge, head.x));
    head.y = Math.max(edge, Math.min(COLS - edge, head.y));
    finish("撞到墙啦", "再试一次，转弯要早一点点。");
    return;
  }

  const spacing = 0.74;
  for (let index = 1; index < snake.length; index += 1) {
    const leader = snake[index - 1];
    const part = snake[index];
    const dx = leader.x - part.x;
    const dy = leader.y - part.y;
    const gap = Math.hypot(dx, dy);
    if (gap > spacing) {
      const move = gap - spacing;
      part.x += dx / gap * move;
      part.y += dy / gap * move;
    }
  }

  const hitBody = snake.slice(5).some(
    (part) => Math.hypot(head.x - part.x, head.y - part.y) < BODY_HIT_DISTANCE,
  );
  if (hitBody) {
    finish("咬到自己啦", "身体变长以后，要给自己留一条路。");
    return;
  }

  const eatDistance = HEAD_RADIUS + FOOD_RADIUS + EAT_PADDING;
  if (food && Math.hypot(head.x - food.x, head.y - food.y) <= eatDistance) {
    const tail = snake[snake.length - 1];
    snake.push({ x: tail.x, y: tail.y });
    score += 1;
    remember();
    gameAudio.effect("collect");
    placeFood();
    speed = Math.min(6.2, 3.5 + score * 0.12);
  }
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawFood(x, y) {
  const cx = x * cell;
  const cy = y * cell;
  const radius = cell * FOOD_RADIUS;
  ctx.fillStyle = "#ff6b93";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.beginPath();
  ctx.arc(cx - radius * 0.35, cy - radius * 0.35, radius * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7dce8a";
  ctx.beginPath();
  ctx.ellipse(cx + radius * 0.15, cy - radius * 0.9, radius * 0.42, radius * 0.2, -0.7, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  if (!cell) return;
  for (let y = 0; y < COLS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#fff7fb" : "#ffe8f3";
      ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
    }
  }
  if (food) drawFood(food.x, food.y);
  snake.forEach((part, index) => {
    const pad = cell * 0.16;
    const size = cell - pad * 2;
    ctx.fillStyle = index === 0 ? "#ff7eae" : index > snake.length * 0.55 ? "#d7c6ff" : "#ffb3d4";
    roundRect(part.x * cell - size / 2, part.y * cell - size / 2, size, size, cell * 0.22);
    ctx.fill();
    if (index !== 0) return;
    const ox = dir.x * cell * 0.08;
    const oy = dir.y * cell * 0.08;
    const cx = part.x * cell + ox;
    const cy = part.y * cell + oy;
    const eyes = [
      [cx - cell * 0.12, cy - cell * 0.08],
      [cx + cell * 0.12, cy - cell * 0.08],
    ];
    eyes.forEach(([ex, ey]) => {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex, ey, cell * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5c3d6e";
      ctx.beginPath();
      ctx.arc(ex + dir.x * 2, ey + dir.y * 2, cell * 0.035, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

function layout() {
  const size = Math.floor(boardWrap.clientWidth);
  if (size < 20) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bitmap = Math.floor(size * dpr);
  if (canvas.width !== bitmap) {
    canvas.width = bitmap;
    canvas.height = bitmap;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cell = size / COLS;
  draw();
}

function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(ts - lastTs, 40);
  lastTs = ts;
  if (running && !paused && !over) {
    update(dt);
    if (!over) draw();
  }
  requestAnimationFrame(loop);
}

function clearControls() {
  padPointer = null;
  queuedDir = null;
  touchControls?.reset();
  document.querySelectorAll(".pad .active").forEach(button => button.classList.remove("active"));
}

document.querySelectorAll(".pad button").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || padPointer !== null || paused || over) return;
    event.preventDefault();
    padPointer = event.pointerId;
    button.setPointerCapture?.(event.pointerId);
    button.classList.add("active");
    const [x, y] = button.dataset.dir.split(",").map(Number);
    setDir(x, y);
  });
  const release = event => {
    if (event.pointerId !== padPointer) return;
    padPointer = null;
    button.classList.remove("active");
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(type, release);
  button.addEventListener("click", event => {
    if (event.detail === 0) { const [x,y] = button.dataset.dir.split(",").map(Number); setDir(x,y); }
  });
});

bindSwipe(canvas, {
  onInteract: unlock,
  enabled: () => !paused && !over,
  repeat: () => true,
  onDirection: (direction) => {
    const [x, y] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[direction];
    setDir(x, y);
  },
});

window.addEventListener("keydown", (event) => {
  const map = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
  };
  const next = map[event.key];
  if (next) {
    event.preventDefault();
    setDir(next[0], next[1]);
    return;
  }
  if (event.key === " " && running && !over) {
    event.preventDefault();
    pauseBtn.click();
  }
});

pauseBtn.addEventListener("click", () => {
  unlock();
  if (!running || over) return;
  clearControls();
  paused = !paused;
  pauseBtn.textContent = paused ? "继续" : "暂停";
  hintEl.textContent = paused ? "暂停中" : "吃到粉色果子就会变长";
  syncTouch();
});

function restart() {
  unlock();
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
    /* 记不住开关也没关系 */
  }
  paintSound();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden || !running || over || paused) return;
  clearControls();
  paused = true;
  pauseBtn.textContent = "继续";
  hintEl.textContent = "暂停中";
  syncTouch();
});

window.addEventListener("blur", () => {
  clearControls();
  if (!running || over || paused) return;
  paused = true;
  pauseBtn.textContent = "继续";
  hintEl.textContent = "离开页面，已自动暂停";
  syncTouch();
});

function syncTouch() {
  touchControls?.setEnabled(!over);
  touchControls?.setActions([{ id: "pause", label: paused ? "继续" : "暂停", primary: true, disabled: !running || over }]);
}

if (window.createTouchControls) {
  touchControls = createTouchControls({
    mount: document.querySelector("#touchDock"), axis: "four", label: "拇指转弯",
    onMove: ({keys}) => {
      const next = {left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]}[keys[0]];
      if (next) setDir(...next);
    },
    onAction: (id, pressed) => { if (id === "pause" && pressed) pauseBtn.click(); },
  });
  document.body.classList.add("touch-ready");
}

document.addEventListener("touchmove", (event) => {
  if (event.target.closest(".stage")) event.preventDefault();
}, { passive: false });

best = loadBest();
soundOn = loadSound();
paintSound();
reset();
layout();
new ResizeObserver(() => layout()).observe(boardWrap);
requestAnimationFrame(() => layout());
requestAnimationFrame(loop);
