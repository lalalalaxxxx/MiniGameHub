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
    return `<button type="button" class="chip${on ? " is-on" : ""}" role="tab" aria-pressed="${on}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`;
  }).join("");
}

function cardHtml(game) {
  return `
    <a class="card" href="${escapeHtml(game.entry)}">
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
    const haystack = `${game.title} ${game.blurb || ""}`.toLowerCase();
    return categoryOk && (!query || haystack.includes(query));
  });
}

function renderGrid() {
  const list = visibleGames();
  countEl.textContent = `${list.length} 个游戏`;
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
  renderGrid();

  filtersEl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    renderFilters();
    renderGrid();
  });

  searchEl.addEventListener("input", () => {
    state.query = searchEl.value.trim();
    renderGrid();
  });
}

init();
