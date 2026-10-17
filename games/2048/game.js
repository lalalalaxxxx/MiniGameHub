const BEST_KEY = "childgame.2048.best";
const SOUND_KEY = "childgame.sound";
const gameAudio = createGameAudio({
  game: "2048",
  isEnabled: () => soundOn,
  isPlaying: () => mode === "play",
  isPaused: () => false,
});
const MOVE_MS = 150;

const boardEl = document.querySelector("#board");
const gridBgEl = document.querySelector("#gridBg");
const tileLayerEl = document.querySelector("#tileLayer");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const restartBtn = document.querySelector("#restart");
const soundBtn = document.querySelector("#sound");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const continueBtn = document.querySelector("#continue");
const againBtn = document.querySelector("#again");

let grid = [];
let score = 0;
let best = 0;
let mode = "play";
let celebrated = false;
let animating = false;
let queuedDirection = null;
let generation = 0;
let tileId = 0;
let soundOn = true;

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

function setScore(value) {
  score = value;
  if (score > best) {
    best = score;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (error) {
      /* 无痕模式可能写不进去 */
    }
  }
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
}

function hideOverlay() {
  overlay.hidden = true;
  continueBtn.hidden = true;
}

function showOverlay(title, text, canContinue) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  continueBtn.hidden = !canContinue;
  overlay.hidden = false;
  (canContinue ? continueBtn : againBtn).focus();
}

function valueClass(value) {
  return value <= 2048 ? `v${value}` : "vsuper";
}

function paintTile(tile) {
  tile.el.textContent = String(tile.value);
  tile.el.className = `tile ${valueClass(tile.value)}${String(tile.value).length >= 4 ? " dense" : ""}`;
  tile.el.style.setProperty("--row", String(tile.row));
  tile.el.style.setProperty("--col", String(tile.col));
}

function makeTile(value, row, col, animateSpawn = true) {
  const el = document.createElement("div");
  const tile = {
    id: ++tileId,
    value,
    row,
    col,
    el,
    mergeInto: null,
    nextValue: null,
  };
  paintTile(tile);
  if (animateSpawn) el.classList.add("spawn");
  tileLayerEl.appendChild(el);
  return tile;
}

function emptyCells(source = grid) {
  const cells = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      if (!source[row][col]) cells.push([row, col]);
    }
  }
  return cells;
}

function spawn() {
  const cells = emptyCells();
  if (!cells.length) return;
  const [row, col] = cells[Math.floor(Math.random() * cells.length)];
  grid[row][col] = makeTile(Math.random() < 0.9 ? 2 : 4, row, col);
}

function coordinates(direction, line) {
  const coords = [];
  for (let index = 0; index < 4; index += 1) {
    if (direction === "left") coords.push([line, index]);
    if (direction === "right") coords.push([line, 3 - index]);
    if (direction === "up") coords.push([index, line]);
    if (direction === "down") coords.push([3 - index, line]);
  }
  return coords;
}

function planMove(direction) {
  const next = Array.from({ length: 4 }, () => Array(4).fill(null));
  const moving = [];
  const survivors = [];
  let gained = 0;
  let changed = false;

  for (let line = 0; line < 4; line += 1) {
    const coords = coordinates(direction, line);
    const tiles = coords
      .map(([row, col]) => grid[row][col])
      .filter(Boolean);
    const placed = [];

    tiles.forEach((tile) => {
      const last = placed[placed.length - 1];
      if (last && last.value === tile.value && !last.nextValue) {
        const target = coords[placed.length - 1];
        tile.mergeInto = last;
        tile.toRow = target[0];
        tile.toCol = target[1];
        last.nextValue = last.value * 2;
        gained += last.nextValue;
        changed = true;
        moving.push(tile);
        return;
      }

      const target = coords[placed.length];
      tile.mergeInto = null;
      tile.nextValue = null;
      tile.toRow = target[0];
      tile.toCol = target[1];
      if (tile.row !== tile.toRow || tile.col !== tile.toCol) changed = true;
      placed.push(tile);
      survivors.push(tile);
      moving.push(tile);
    });

    placed.forEach((tile, index) => {
      const [row, col] = coords[index];
      next[row][col] = tile;
    });
  }

  return { next, moving, survivors, gained, changed };
}

function canMove() {
  if (emptyCells().length) return true;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const value = grid[row][col].value;
      if (col + 1 < 4 && grid[row][col + 1].value === value) return true;
      if (row + 1 < 4 && grid[row + 1][col].value === value) return true;
    }
  }
  return false;
}

function has2048() {
  return grid.some((row) => row.some((tile) => tile && tile.value >= 2048));
}

function finishMove(plan, token) {
  if (token !== generation) return;
  plan.moving.forEach((tile) => {
    if (tile.mergeInto) {
      tile.el.remove();
      return;
    }
    tile.row = tile.toRow;
    tile.col = tile.toCol;
    if (tile.nextValue) {
      tile.value = tile.nextValue;
      tile.nextValue = null;
      paintTile(tile);
      tile.el.classList.add("merge");
    } else {
      paintTile(tile);
    }
  });

  grid = plan.next;
  setScore(score + plan.gained);
  spawn();
  animating = false;
  if (plan.gained) gameAudio.effect("merge");

  if (!celebrated && has2048()) {
    celebrated = true;
    mode = "win";
    gameAudio.effect("clear");
    showOverlay("拼出来啦", "你已经得到 2048，还可以继续拼更大的数字。", true);
  } else if (!canMove()) {
    mode = "over";
    gameAudio.effect("over");
    showOverlay("没有空格啦", "再来一局，试试不同的顺序。", false);
  }

  if (queuedDirection && mode === "play") {
    const direction = queuedDirection;
    queuedDirection = null;
    requestAnimationFrame(() => move(direction));
  }
}

function move(direction) {
  unlock();
  if (mode !== "play") return false;
  if (animating) {
    queuedDirection = direction;
    return false;
  }
  const plan = planMove(direction);
  if (!plan.changed) return false;

  gameAudio.effect("move", { volume: .4 });
  animating = true;
  const token = generation;
  // 先保留旧位置一帧，再同时移动所有方块。
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      plan.moving.forEach((tile) => {
        tile.el.style.setProperty("--row", String(tile.toRow));
        tile.el.style.setProperty("--col", String(tile.toCol));
      });
      window.setTimeout(() => finishMove(plan, token), MOVE_MS + 20);
    });
  });
  return true;
}

function fresh() {
  generation += 1;
  grid = Array.from({ length: 4 }, () => Array(4).fill(null));
  mode = "play";
  celebrated = false;
  animating = false;
  queuedDirection = null;
  tileLayerEl.replaceChildren();
  hideOverlay();
  setScore(0);
  spawn();
  spawn();
}

function buildBackground() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 16; index += 1) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    fragment.appendChild(cell);
  }
  gridBgEl.replaceChildren(fragment);
}

document.querySelectorAll(".pad button").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    move(button.dataset.dir);
  });
});

bindSwipe(document.querySelector(".stage"), {
  onInteract: unlock,
  enabled: () => mode === "play",
  onDirection: move,
});

window.addEventListener("keydown", (event) => {
  const map = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
  };
  const direction = map[event.key];
  if (!direction) return;
  event.preventDefault();
  move(direction);
});

restartBtn.addEventListener("click", () => {
  unlock();
  fresh();
});

againBtn.addEventListener("click", () => {
  unlock();
  fresh();
});

continueBtn.addEventListener("click", () => {
  hideOverlay();
  mode = "play";
  if (!canMove()) {
    mode = "over";
    gameAudio.effect("over");
    showOverlay("没有空格啦", "再来一局，试试不同的顺序。", false);
  }
});

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

document.addEventListener("touchmove", (event) => {
  if (event.target.closest(".stage")) event.preventDefault();
}, { passive: false });

best = loadBest();
bestEl.textContent = String(best);
soundOn = loadSound();
paintSound();
buildBackground();
fresh();
