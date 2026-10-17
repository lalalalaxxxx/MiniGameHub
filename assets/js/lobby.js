const state = {
  games: [],
  category: "全部",
  query: "",
};

const filtersEl = document.querySelector("#filters");
const gridEl = document.querySelector("#grid");
const emptyEl = document.querySelector("#empty");
const searchEl = document.querySelector("#search");
const countEl = document.querySelector("#count");
const recentEl = document.querySelector("#recent");
const recentList = document.querySelector("#recent-list");
const resetEl = document.querySelector("#reset");
const recentKey = "childgame.lobby.recent.v1";
const icons = { 全部: "✦", 学习: "📚", 益智: "🧩", 休闲: "🌈", 经典: "🎮", 反应: "⚡", 动作: "🚀", 生活: "🍱", 观察: "🔎", 音乐: "♫" };
const aliases = { shooter: "飞机 打飞机 射击", quietbook: "换装 公主 娃娃", tangram: "七巧板 拼图", market: "购物 买东西 算钱 数学", robot: "编程 路线", bento: "做饭 厨房", memory: "翻牌 配对", rhythm: "乐器 音乐", sudoku: "数字 数学", pipes: "水管 接水", bridge: "搭桥 建造", patterns: "规律 排序" };
let recents = [];
function readRecents() {
  try { const value = JSON.parse(localStorage.getItem(recentKey)); recents = Array.isArray(value) ? [...new Set(value.filter(id => typeof id === "string"))].slice(0, 6) : []; } catch { recents = []; }
}
function renderRecent() {
  const games = recents.map(id => state.games.find(game => game.id === id)).filter(Boolean);
  recentEl.hidden = !games.length || !!state.query || state.category !== "全部";
  recentList.innerHTML = games.map(game => `<a class="recent-game" data-game="${escapeHtml(game.id)}" href="${escapeHtml(game.entry)}"><img src="${escapeHtml(game.cover)}" alt=""><span>${escapeHtml(game.title)}</span><span aria-hidden="true">↗</span></a>`).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);
}

function renderFilters() {
  const categories = ["全部", ...new Set(state.games.map((game) => game.category).filter(Boolean))];
  filtersEl.innerHTML = categories.map((category) => {
    const on = category === state.category;
    return `<button type="button" class="chip${on ? " is-on" : ""}" aria-pressed="${on}" data-category="${escapeHtml(category)}"><span aria-hidden="true">${icons[category] || "✦"}</span>${escapeHtml(category)}<small>${category === "全部" ? state.games.length : state.games.filter(g => g.category === category).length}</small></button>`;
  }).join("");
}

function cardHtml(game) {
  return `
    <a class="card" data-game="${escapeHtml(game.id)}" href="${escapeHtml(game.entry)}">
      <span class="cover">
        <img src="${escapeHtml(game.cover || "")}" alt="">
      </span>
      <span class="card-body">
        <span class="card-top">
          <h2>${escapeHtml(game.title)}</h2>
          <span class="pill">${escapeHtml(game.category || "游戏")}</span>
        </span>
        <p>${escapeHtml(game.blurb || "")}</p>
        <span class="play">开始玩</span>
      </span>
    </a>`;
}

function visibleGames() {
  const query = state.query.toLowerCase();
  return state.games.filter((game) => {
    const categoryOk = state.category === "全部" || game.category === state.category;
    const haystack = `${game.title} ${game.blurb || ""} ${game.category} ${(game.tags || []).join(" ")} ${aliases[game.id] || ""} ${game.id}`.toLowerCase();
    return categoryOk && (!query || query.split(/\s+/).every(word => haystack.includes(word)));
  });
}

function renderGrid() {
  const list = visibleGames();
  countEl.textContent = `${list.length} 个游戏`;
  document.querySelector("#library-title").textContent = state.query ? "搜索结果" : state.category === "全部" ? "全部游戏" : state.category === "学习" ? "学习乐园 · 幼儿园 / 二年级" : `${state.category}游戏`;
  resetEl.hidden = !state.query && state.category === "全部";
  renderRecent();
  emptyEl.hidden = list.length !== 0;
  gridEl.innerHTML = list.map(cardHtml).join("");
}

function showLoadError() {
  countEl.textContent = "";
  emptyEl.hidden = true;
  gridEl.innerHTML = `<p class="empty">游戏清单没有加载出来。请用网站服务打开这个页面，不要直接双击文件。</p>`;
}

async function init() {
  try {
    const response = await fetch("games/manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("format");
    state.games = data.filter((game) => game && game.title && game.entry);
  } catch (error) {
    showLoadError();
    return;
  }

  renderFilters();
  readRecents();
  renderGrid();

  filtersEl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    filtersEl.querySelectorAll("button").forEach(el => { const on = el === button; el.classList.toggle("is-on", on); el.setAttribute("aria-pressed", String(on)); });
    renderGrid();
  });

  searchEl.addEventListener("input", () => {
    state.query = searchEl.value.trim();
    renderGrid();
  });
  resetEl.addEventListener("click", () => {
    state.category = "全部"; state.query = ""; searchEl.value = "";
    renderFilters(); renderGrid(); searchEl.focus();
  });
  document.addEventListener("click", event => {
    const link = event.target.closest("a[data-game]");
    if (!link) return;
    readRecents(); recents = [link.dataset.game, ...recents.filter(id => id !== link.dataset.game)].slice(0, 6);
    try { localStorage.setItem(recentKey, JSON.stringify(recents)); } catch { /* Private browsing can disable storage. */ }
  });
  window.addEventListener("pageshow", () => { readRecents(); renderRecent(); });
  window.addEventListener("storage", event => { if (event.key === recentKey || event.key === null) { readRecents(); renderRecent(); } });
}

init();
