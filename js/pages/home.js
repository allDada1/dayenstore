function getEls() {
  return {
    search: document.getElementById("searchInput") || document.querySelector("[data-search]"),
    clear: document.getElementById("clearBtn") || document.querySelector("[data-search-clear]"),
    grid: document.getElementById("productsGrid") || document.getElementById("grid"),
    meta: document.getElementById("resultMeta"),
    empty: document.getElementById("emptyState"),
    reset: document.getElementById("resetBtn"),
    chips: document.getElementById("categoryChips"),

    sortRow: document.getElementById("sortRow"),
    sort: document.getElementById("sortSelect"),

    cartBtn: document.getElementById("cartBtn"),
    cartBadge: document.getElementById("cartBadge"),
    profileBtn: document.getElementById("profileBtn"),
    goAdmin: document.getElementById("goAdmin"),
    goAdminCats: document.getElementById("goAdminCats"),
    goProfile: document.getElementById("goProfile"),
    goLogin: document.getElementById("goLogin"),
    goReg: document.getElementById("goReg"),

    popularWrap: document.getElementById("popularWrap"),
    popularLiked: document.getElementById("popularLiked"),
    popularRated: document.getElementById("popularRated"),
    recentSection: document.querySelector(".recentSection"),
    recentProducts: document.getElementById("recentProducts")
  };
}

let els = {};
let state = { q: "", cat: "Все", sort: "new_desc" };
let me = null;

const Utils = window.MarketUtils || {};
const RECENT_ITEMS_KEY = "market_recent_products_v1";
const RECENT_IDS_KEY = "market_recently_viewed";

function token() {
  return Utils.getToken ? Utils.getToken() : MarketAPI.getToken();
}

function readInitialQueryFromUrl() {
  try {
    const params = new URLSearchParams(location.search || "");
    const q = (params.get("q") || "").trim();
    if (q) state.q = q;
  } catch {}
}

function syncHeaderSearchValue(value) {
  const input = document.getElementById("searchInput") || els.search;
  if (input && input.value !== String(value || "")) {
    input.value = String(value || "");
  }
}

function updateSortUI() {
  const searching = state.q.trim().length > 0;
  if (els.sortRow) els.sortRow.hidden = !searching;
}

function setSearchQuery(q) {
  state.q = String(q || "").trim();
  syncHeaderSearchValue(state.q);
  updateSortUI();
  HomeCatalog.updatePopularVisibility();
}

function syncQueryToUrl(q) {
  try {
    const url = new URL(location.href);
    if (q && String(q).trim()) {
      url.searchParams.set("q", String(q).trim());
    } else {
      url.searchParams.delete("q");
    }
    history.replaceState({}, "", url.toString());
  } catch {}
}

function updateCartBadge() {
  HomeCart.updateBadge();
}

function addToCart(id) {
  HomeCart.add(id);
}

function animateToCart(fromEl) {
  HomeCart.animateToCart(fromEl);
}

async function loadMe() {
  if (!token()) {
    me = null;
    updateTopUserUI();
    return;
  }

  const res = await MarketAPI.apiFetch("/api/auth/me");
  if (!res.ok) {
    me = null;
    updateTopUserUI();
    return;
  }

  const data = await res.json().catch(() => ({}));
  me = data.user || null;
  updateTopUserUI();
}

function updateTopUserUI() {
  const span = els.profileBtn?.querySelector("span:last-child");
  if (span) span.textContent = me ? "Профиль" : "Войти";

  if (els.goAdmin) els.goAdmin.style.display = (me && me.is_admin) ? "" : "none";
  if (els.goAdminCats) els.goAdminCats.style.display = (me && me.is_admin) ? "" : "none";
  if (els.goProfile) els.goProfile.style.display = me ? "" : "none";
  if (els.goLogin) els.goLogin.style.display = me ? "none" : "";
  if (els.goReg) els.goReg.style.display = me ? "none" : "";
}

function skeletonCards(count = 8) {
  return Array.from({ length: count }, () => `
    <article class="skeletonCard" aria-hidden="true">
      <div class="skeletonCard__img"></div>
      <div class="skeletonCard__body">
        <div class="skeletonTop">
          <div class="skeletonPill skeletonPill--sm"></div>
          <div class="skeletonPill skeletonPill--xs"></div>
        </div>
        <div class="skeletonLine skeletonLine--title"></div>
        <div class="skeletonLine skeletonLine--text"></div>
        <div class="skeletonLine skeletonLine--text2"></div>
        <div class="skeletonRow">
          <div>
            <div class="skeletonLine skeletonPrice"></div>
            <div class="skeletonLine skeletonMini"></div>
          </div>
          <div class="skeletonBtn"></div>
        </div>
      </div>
    </article>
  `).join("");
}

function applyCardEnhancements(container) {
  if (!container) return;

  container.querySelectorAll(".card").forEach((card, index) => {
    card.style.setProperty("--stagger", String(index % 12));

    if (!card.dataset.enhanced) {
      card.classList.add("is-entering");

      card.addEventListener("animationend", () => {
        card.classList.remove("is-entering");
      }, { once: true });

      card.dataset.enhanced = "1";
    }
  });

  container.querySelectorAll("img").forEach((img) => {
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    img.setAttribute("fetchpriority", "low");
    img.setAttribute("draggable", "false");
  });
}

function wireStaticEvents() {
  els.clear?.addEventListener("click", () => {
    setSearchQuery("");
    syncQueryToUrl("");
    HomeCatalog.renderProducts({ reset: true });
  });

  els.reset?.addEventListener("click", () => {
    state.q = "";
    state.cat = "Все";
    state.sort = "new_desc";

    syncHeaderSearchValue("");
    syncQueryToUrl("");

    if (els.sort) els.sort.value = "new_desc";

    HomeCatalog.renderChips();
    updateSortUI();
    HomeCatalog.updatePopularVisibility();
    HomeCatalog.renderProducts({ reset: true });
  });

  els.sort?.addEventListener("change", () => {
    state.sort = els.sort.value;
    HomeCatalog.renderProducts({ reset: true });
  });

  els.cartBtn?.addEventListener("click", () => {
    location.href = token() ? "cart.html" : "login.html";
  });

  els.profileBtn?.addEventListener("click", () => {
    location.href = token() ? "profile.html" : "login.html";
  });
}

function createSearchBridge() {
  return {
    getQuery() {
      return state.q;
    },
    submitQuery(q) {
      setSearchQuery(q);
      syncQueryToUrl(state.q);
      return HomeCatalog.renderProducts({ reset: true });
    }
  };
}

function readRecentIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_IDS_KEY) || "[]");
    return Array.isArray(raw)
      ? raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [];
  } catch {
    return [];
  }
}

function readRecentItems() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_ITEMS_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function toRecentCardRows(allProducts) {
  const ids = readRecentIds();
  const byId = new Map((allProducts || []).map((item) => [Number(item.id), item]));
  const rows = [];

  for (const id of ids) {
    const full = byId.get(Number(id));
    if (full) rows.push(full);
  }

  if (rows.length) return rows.slice(0, 8);

  return readRecentItems()
    .filter((item) => item && Number(item.id) > 0)
    .slice(0, 8);
}

function renderRecentProducts(allProducts) {
  if (!els.recentProducts || !els.recentSection || !window.ProductCard) return;

  const rows = toRecentCardRows(allProducts);
  if (!rows.length) {
    els.recentSection.hidden = true;
    els.recentProducts.innerHTML = "";
    return;
  }

  els.recentSection.hidden = false;
  els.recentProducts.innerHTML = rows
    .map((product) => window.ProductCard.template(product, HomeFavorites.getLikedIds()))
    .join("");

  window.ProductCard.bindClicks(
    els.recentProducts,
    addToCart,
    (id, btn) => HomeFavorites.toggle(id, btn)
  );
  applyCardEnhancements(els.recentProducts);
}

async function initApp() {
  readInitialQueryFromUrl();
  els = getEls();

  syncHeaderSearchValue(state.q);

  HomeCart.init({ els });
  HomeFavorites.init();

  HomeCatalog.init({
    els,
    state,
    getLikedIds: () => HomeFavorites.getLikedIds(),
    addToCart,
    toggleFavorite: (id, btn) => HomeFavorites.toggle(id, btn),
    applyCardEnhancements,
    skeletonCards
  });

  HomeSearch.init({
    catalogApi: HomeCatalog,
    appApi: createSearchBridge()
  });

  updateCartBadge();
  wireStaticEvents();
  updateSortUI();
  HomeCatalog.updatePopularVisibility();

  if (els.grid) {
    els.grid.innerHTML = skeletonCards(8);
  }

  await loadMe();
  await HomeCatalog.loadCategories();
  await HomeFavorites.load();

  if (els.sort?.value) {
    state.sort = els.sort.value;
  }

  await HomeCatalog.renderProducts({ reset: true });
  await HomeCatalog.renderPopular();

  const allProducts = await HomeCatalog.apiGetAllProducts();
  renderRecentProducts(allProducts);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
