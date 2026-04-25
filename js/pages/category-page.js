// js/pages/category-page.js

(function () {
  const els = {
    catTitle: document.getElementById("catTitle"),
    catSub: document.getElementById("catSub"),
    search: document.getElementById("searchInput"),
    clear: document.getElementById("clearBtn"),
    grid: document.getElementById("productsGrid"),
    meta: document.getElementById("resultMeta"),
    empty: document.getElementById("emptyState"),
    reset: document.getElementById("resetBtn"),
    chips: document.getElementById("categoryChips"),

    cartBtn: document.getElementById("cartBtn"),
    cartBadge: document.getElementById("cartBadge"),
    profileBtn: document.getElementById("profileBtn"),
    notifBtn: document.getElementById("notifBtn"),
notifBadge: document.getElementById("notifBadge"),
  };

  const state = { q: "", cat: "Все" };
  const Utils = window.MarketUtils || {};

  function token() {
    return Utils.getToken ? Utils.getToken() : (window.MarketAPI?.getToken?.() || "");
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
      card.classList.add("is-entering");
      card.style.setProperty("--stagger", String(index % 12));

      card.addEventListener("animationend", () => {
        card.classList.remove("is-entering");
      }, { once: true });
    });

    container.querySelectorAll("img").forEach((img) => {
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      img.setAttribute("fetchpriority", "low");
      img.setAttribute("draggable", "false");
    });
  }

  async function updateProfileButton() {
  const span = els.profileBtn?.querySelector("span");
  if (!span) return;

  if (!token()) {
    span.textContent = "Войти";
    return;
  }

  let session = window.Auth?.getSession?.() || null;

  if (!session && window.Auth?.getMe) {
    try {
      session = await window.Auth.getMe();
    } catch {}
  }

  const rawName =
    session?.name ||
    session?.nickname ||
    session?.login ||
    session?.email ||
    "Профиль";

  const safeName = String(rawName).trim();
  span.textContent = safeName || "Профиль";
}

  function initStaticEvents() {
    els.search?.addEventListener("input", () => {
      state.q = els.search.value || "";
      CategoryCatalogFeature.renderProducts();
    });

    els.clear?.addEventListener("click", () => {
      if (els.search) els.search.value = "";
      state.q = "";
      CategoryCatalogFeature.renderProducts();
    });

    els.notifBtn?.addEventListener("click", () => {
  location.href = token() ? "profile.html#notifications" : "login.html";
});

    els.reset?.addEventListener("click", () => {
      state.q = "";
      state.cat = "Все";

      if (els.search) els.search.value = "";
      CategoryCatalogFeature.renderChips();
      CategoryCatalogFeature.setCategoryHero();
      CategoryCatalogFeature.renderProducts();
    });

    els.cartBtn?.addEventListener("click", () => {
      location.href = token() ? "cart.html" : "login.html";
    });

    els.profileBtn?.addEventListener("click", () => {
      location.href = token() ? "profile.html" : "login.html";
    });

    
    window.addEventListener("market:auth-changed", () => {
  updateProfileButton();
  HomeCart.updateBadge?.();
});
  }

  function init() {
    if (!window.CategoryCatalogFeature || !window.ProductCard || !window.HomeCart || !window.HomeFavorites) {
      console.error("Category page features are not loaded");
      return;
    }

    Promise.resolve(updateProfileButton());

    HomeCart.init({ els });
    HomeCart.updateBadge?.();
    HomeFavorites.init();

    CategoryCatalogFeature.init({
      els,
      state,
      getLikedIds: () => HomeFavorites.getLikedIds(),
      addToCart: (id) => HomeCart.add(id),
      toggleFavorite: (id, btn) => HomeFavorites.toggle(id, btn),
      animateToCart: (btn) => HomeCart.animateToCart(btn),
      applyCardEnhancements,
      skeletonCards
    });

    initStaticEvents();

    if (els.grid) {
      els.grid.innerHTML = skeletonCards(8);
    }

    Promise.resolve()
      .then(() => HomeFavorites.load())
      .then(() => CategoryCatalogFeature.loadCategories())
      .then(() => CategoryCatalogFeature.renderProducts());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();