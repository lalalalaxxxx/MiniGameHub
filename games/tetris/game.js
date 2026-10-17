const COLS = 10;
const ROWS = 20;
const BEST_KEY = "childgame.tetris.best";
const SOUND_KEY = "childgame.sound";
const gameAudio = createGameAudio({
  game: "tetris",
  isEnabled: () => soundOn,
  isPlaying: () => state === "playing",
  isPaused: () => state === "paused",
});

const COLORS = {
  I: "#79dce5",
  J: "#9f8bea",
  L: "#ffb06f",
  O: "#ffd76f",
  S: "#83d6a1",
  T: "#d58ee6",
  Z: "#ff87a7",
};

const SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
};

const boardCanvas = document.querySelector("#board");
const nextCanvas = document.querySelector("#next");
const boardCtx = boardCanvas.getContext("2d");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const levelEl = document.querySelector("#level");
const linesEl = document.querySelector("#lines");
const hintEl = document.querySelector("#hint");
const pauseBtn = document.querySelector("#pause");
const restartBtn = document.querySelector("#restart");
const soundBtn = document.querySelector("#sound");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const againBtn = document.querySelector("#again");

let board = [];
let bag = [];
let active = null;
let nextType = null;
let score = 0;
let best = 0;
let lines = 0;
let level = 1;
let state = "playing";
let lastTime = 0;
let fallElapsed = 0;
let boardCell = 0;
let soundOn = true;
let holdTimer = 0;
let holdInterval = 0;

function readNumber(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch (error) {
    return 0;
  }
}

function readSound() {
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
    /* 无痕模式可能无法保存，但本局仍可继续。 */
  }
}

function updateInfo() {
  saveBest();
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
  levelEl.textContent = String(level);
  linesEl.textContent = String(lines);
}

function paintSound() {
  gameAudio.sync();
}

function unlockAudio() {
  gameAudio.unlock();
}

function shuffledBag() {
  const pieces = Object.keys(SHAPES);
  for (let index = pieces.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pieces[index], pieces[swapIndex]] = [pieces[swapIndex], pieces[index]];
  }
  return pieces;
}

function takePiece() {
  if (!bag.length) bag = shuffledBag();
  return bag.pop();
}

function cellsOf(piece, rotation = piece.rotation, x = piece.x, y = piece.y) {
  return SHAPES[piece.type][rotation].map(([offsetX, offsetY]) => ({
    x: x + offsetX,
    y: y + offsetY,
  }));
}

function collides(piece, rotation = piece.rotation, x = piece.x, y = piece.y) {
  return cellsOf(piece, rotation, x, y).some((cell) => (
    cell.x < 0
    || cell.x >= COLS
    || cell.y >= ROWS
    || (cell.y >= 0 && board[cell.y][cell.x])
  ));
}

function spawnPiece() {
  active = {
    type: nextType,
    rotation: 0,
    x: 3,
    y: 0,
    slideFromX: 3,
    slideStartedAt: 0,
  };
  nextType = takePiece();
  drawNext();
  if (collides(active)) finishGame();
}

function dropDelay() {
  return Math.max(95, 800 * Math.pow(0.84, level - 1));
}

function visualX(now = performance.now()) {
  if (!active || !active.slideStartedAt) return active?.x ?? 0;
  const progress = Math.min(1, (now - active.slideStartedAt) / 85);
  const eased = 1 - Math.pow(1 - progress, 3);
  return active.slideFromX + (active.x - active.slideFromX) * eased;
}

function visualY() {
  if (!active || state === "over") return active?.y ?? 0;
  if (collides(active, active.rotation, active.x, active.y + 1)) return active.y;
  return active.y + Math.min(1, fallElapsed / dropDelay());
}

function moveHorizontal(amount) {
  if (state !== "playing" || collides(active, active.rotation, active.x + amount, active.y)) return false;
  active.slideFromX = visualX();
  active.slideStartedAt = performance.now();
  active.x += amount;
  gameAudio.effect("move", { volume: .45 });
  return true;
}

function moveDown(manual = false) {
  if (state !== "playing") return false;
  if (!collides(active, active.rotation, active.x, active.y + 1)) {
    active.y += 1;
    if (manual) {
      score += 1;
      updateInfo();
      fallElapsed = 0;
    }
    return true;
  }
  lockPiece();
  return false;
}

function rotatePiece() {
  if (state !== "playing") return;
  const nextRotation = (active.rotation + 1) % 4;
  const kicks = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];
  for (const [kickX, kickY] of kicks) {
    const x = active.x + kickX;
    const y = active.y + kickY;
    if (!collides(active, nextRotation, x, y)) {
      active.rotation = nextRotation;
      active.x = x;
      active.y = y;
      gameAudio.effect("rotate");
      drawBoard();
      return;
    }
  }
}

function ghostY() {
  let y = active.y;
  while (!collides(active, active.rotation, active.x, y + 1)) y += 1;
  return y;
}

function hardDrop() {
  if (state !== "playing") return;
  const landingY = ghostY();
  const distance = landingY - active.y;
  active.y = landingY;
  score += distance * 2;
  gameAudio.effect("drop");
  lockPiece();
}

function clearLines() {
  let cleared = 0;
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (!board[row].every(Boolean)) continue;
    board.splice(row, 1);
    board.unshift(Array(COLS).fill(null));
    cleared += 1;
    row += 1;
  }
  if (!cleared) return;

  const rewards = [0, 100, 300, 500, 800];
  score += rewards[cleared] * level;
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  hintEl.textContent = cleared === 4 ? "太厉害啦！一次消掉四行！" : `消掉 ${cleared} 行，继续加油！`;
  gameAudio.effect("clear");
}

function lockPiece() {
  const cells = cellsOf(active);
  if (cells.some((cell) => cell.y < 0)) {
    finishGame();
    return;
  }
  cells.forEach((cell) => {
    board[cell.y][cell.x] = active.type;
  });
  clearLines();
  updateInfo();
  spawnPiece();
  fallElapsed = 0;
  drawBoard();
}

function finishGame() {
  state = "over";
  pauseBtn.disabled = true;
  hintEl.textContent = "方块装满啦";
  updateInfo();
  gameAudio.effect("over");
  overlayTitle.textContent = "方块装满啦";
  overlayText.textContent = `这次得到 ${score} 分，已经很棒啦！`;
  overlay.hidden = false;
  againBtn.focus();
}

function setPaused(paused, message = "暂停中") {
  if (state === "over") return;
  if (paused) stopHold();
  state = paused ? "paused" : "playing";
  pauseBtn.textContent = paused ? "继续" : "暂停";
  hintEl.textContent = paused ? message : "左右滑动移动 · 上滑或轻点旋转 · 下滑落到底";
  if (!paused) {
    lastTime = performance.now();
    fallElapsed = 0;
  }
  drawBoard();
}

function togglePause() {
  unlockAudio();
  if (state === "over") return;
  setPaused(state === "playing");
}

function newGame() {
  stopHold();
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  bag = [];
  score = 0;
  lines = 0;
  level = 1;
  state = "playing";
  nextType = takePiece();
  fallElapsed = 0;
  lastTime = performance.now();
  pauseBtn.disabled = false;
  pauseBtn.textContent = "暂停";
  hintEl.textContent = "左右滑动移动 · 上滑或轻点旋转 · 下滑落到底";
  overlay.hidden = true;
  spawnPiece();
  updateInfo();
  drawBoard();
}

function roundedCell(context, x, y, size, color, alpha = 1) {
  const inset = Math.max(1.5, size * 0.09);
  const left = x + inset;
  const top = y + inset;
  const width = size - inset * 2;
  const radius = Math.min(size * 0.2, width / 2);
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(left + radius, top);
  context.arcTo(left + width, top, left + width, top + width, radius);
  context.arcTo(left + width, top + width, left, top + width, radius);
  context.arcTo(left, top + width, left, top, radius);
  context.arcTo(left, top, left + width, top, radius);
  context.closePath();
  context.fill();
  context.fillStyle = "rgba(255,255,255,.34)";
  context.beginPath();
  context.arc(left + width * 0.3, top + width * 0.27, Math.max(1, width * 0.1), 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function drawBoard() {
  if (!boardCell) return;
  const width = boardCell * COLS;
  const height = boardCell * ROWS;
  boardCtx.clearRect(0, 0, width, height);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      boardCtx.fillStyle = (row + col) % 2 ? "#fbf5ff" : "#fff9fc";
      boardCtx.fillRect(col * boardCell, row * boardCell, boardCell + 0.5, boardCell + 0.5);
      const type = board[row][col];
      if (type) roundedCell(boardCtx, col * boardCell, row * boardCell, boardCell, COLORS[type]);
    }
  }

  if (!active || state === "over") return;
  const drawX = visualX();
  const drawY = visualY();
  const landingY = ghostY();
  if (landingY !== active.y) {
    cellsOf(active, active.rotation, drawX, landingY).forEach((cell) => {
      if (cell.y >= 0) roundedCell(
        boardCtx,
        cell.x * boardCell,
        cell.y * boardCell,
        boardCell,
        COLORS[active.type],
        0.18,
      );
    });
  }
  cellsOf(active, active.rotation, drawX, drawY).forEach((cell) => {
    if (cell.y >= 0) roundedCell(
      boardCtx,
      cell.x * boardCell,
      cell.y * boardCell,
      boardCell,
      COLORS[active.type],
    );
  });

  if (state === "paused") {
    boardCtx.fillStyle = "rgba(92,61,110,.2)";
    boardCtx.fillRect(0, 0, width, height);
  }
}

function drawNext() {
  const cssSize = nextCanvas.clientWidth;
  if (!cssSize || !nextType) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bitmap = Math.floor(cssSize * dpr);
  if (nextCanvas.width !== bitmap || nextCanvas.height !== bitmap) {
    nextCanvas.width = bitmap;
    nextCanvas.height = bitmap;
  }
  nextCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  nextCtx.clearRect(0, 0, cssSize, cssSize);

  const shape = SHAPES[nextType][0];
  const minX = Math.min(...shape.map(([x]) => x));
  const maxX = Math.max(...shape.map(([x]) => x));
  const minY = Math.min(...shape.map(([, y]) => y));
  const maxY = Math.max(...shape.map(([, y]) => y));
  const cell = Math.min(cssSize / 4.6, cssSize / (Math.max(maxX - minX, maxY - minY) + 1.7));
  const offsetX = (cssSize - (maxX - minX + 1) * cell) / 2 - minX * cell;
  const offsetY = (cssSize - (maxY - minY + 1) * cell) / 2 - minY * cell;
  shape.forEach(([x, y]) => roundedCell(
    nextCtx,
    offsetX + x * cell,
    offsetY + y * cell,
    cell,
    COLORS[nextType],
  ));
}

function layout() {
  const width = boardCanvas.clientWidth;
  const height = boardCanvas.clientHeight;
  if (width < 20 || height < 40) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bitmapWidth = Math.floor(width * dpr);
  const bitmapHeight = Math.floor(height * dpr);
  if (boardCanvas.width !== bitmapWidth || boardCanvas.height !== bitmapHeight) {
    boardCanvas.width = bitmapWidth;
    boardCanvas.height = bitmapHeight;
  }
  boardCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  boardCell = width / COLS;
  drawBoard();
  drawNext();
}

function perform(action) {
  unlockAudio();
  if (action === "left") moveHorizontal(-1);
  if (action === "right") moveHorizontal(1);
  if (action === "rotate") rotatePiece();
  if (action === "drop") hardDrop();
}

function stopHold() {
  window.clearTimeout(holdTimer);
  window.clearInterval(holdInterval);
  holdTimer = 0;
  holdInterval = 0;
  document.querySelectorAll(".controls .active").forEach((button) => button.classList.remove("active"));
}

document.querySelectorAll(".controls button").forEach((button) => {
  let ignoreClickUntil = 0;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    stopHold();
    button.setPointerCapture?.(event.pointerId);
    button.classList.add("active");
    ignoreClickUntil = performance.now() + 400;
    const action = button.dataset.action;
    perform(action);
    if (action === "left" || action === "right") {
      holdTimer = window.setTimeout(() => {
        holdInterval = window.setInterval(() => perform(action), 80);
      }, 220);
    }
  });
  button.addEventListener("pointerup", stopHold);
  button.addEventListener("pointercancel", stopHold);
  button.addEventListener("lostpointercapture", stopHold);
  button.addEventListener("click", () => {
    if (performance.now() >= ignoreClickUntil) perform(button.dataset.action);
  });
});

bindSwipe(document.querySelector(".stage"), {
  onInteract: unlockAudio,
  enabled: () => state === "playing",
  repeat: (direction) => direction === "left" || direction === "right",
  onDirection: (direction) => perform({ left: "left", right: "right", up: "rotate", down: "drop" }[direction]),
  onTap: () => perform("rotate"),
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const action = {
    arrowleft: "left",
    arrowright: "right",
    arrowdown: "drop",
    arrowup: "rotate",
    x: "rotate",
    " ": "drop",
  }[key];
  if (action) {
    event.preventDefault();
    if (event.repeat && action === "drop") return;
    perform(action);
    return;
  }
  if (key === "p" || key === "escape") {
    event.preventDefault();
    togglePause();
  }
});

pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", () => {
  unlockAudio();
  newGame();
});
againBtn.addEventListener("click", () => {
  unlockAudio();
  newGame();
});

soundBtn.addEventListener("click", () => {
  soundOn = gameAudio.toggle();
  if (soundOn) gameAudio.unlock(true);
  try {
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  } catch (error) {
    /* 无法保存时只维持当前页面设置。 */
  }
  paintSound();
  if (soundOn) gameAudio.effect("start");
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "playing") setPaused(true, "离开页面，已自动暂停");
});

document.addEventListener("touchmove", (event) => {
  if (event.target.closest(".stage")) event.preventDefault();
}, { passive: false });

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const delta = Math.min(timestamp - lastTime, 100);
  lastTime = timestamp;
  if (state === "playing") {
    fallElapsed += delta;
    const delay = dropDelay();
    while (fallElapsed >= delay && state === "playing") {
      fallElapsed -= delay;
      if (!moveDown(false)) break;
    }
    drawBoard();
  }
  requestAnimationFrame(gameLoop);
}

best = readNumber(BEST_KEY);
soundOn = readSound();
paintSound();
newGame();
layout();
new ResizeObserver(layout).observe(document.querySelector(".game-area"));
requestAnimationFrame(layout);
requestAnimationFrame(gameLoop);
