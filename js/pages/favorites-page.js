const els = {
  search: document.getElementById("searchInput"),
  clear: document.getElementById("clearBtn"),
  sort: document.getElementById("sortSelect"),

  grid: document.getElementById("productsGrid"),
  meta: document.getElementById("resultMeta"),
  empty: document.getElementById("emptyState"),

  cartBtn: document.getElementById("cartBtn"),
  cartBadge: document.getElementById("cartBadge"),
  profileBtn: document.getElementById("profileBtn"),
  goCatalogBtn: document.getElementById("goCatalogBtn"),
};

let state = { q: "", sort: "new_desc" };
let baseList = [];

const Cart = window.MarketStorage;

function token() {
  try {
    return MarketAPI.getToken();
  } catch {
    return "";
  }
}

function formatKZT(value) {
  const s = String(Math.round(Number(value) || 0));
  const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${spaced} ₸`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateCartBadge() {
  const c = Cart?.getCartCount?.() || 0;
  const badge = document.getElementById("cartBadge") || els.cartBadge;
  if (!badge) return;
  badge.hidden = c <= 0;
  badge.textContent = String(c);
}

function addToCart(id) {
  Cart?.addToCart?.(id, 1);
  updateCartBadge();
}

function bumpCartBadge() {
  const badge = document.getElementById("cartBadge") || els.cartBadge;
  if (!badge) return;
  badge.classList.remove("is-bump");
  void badge.offsetWidth;
  badge.classList.add("is-bump");
  setTimeout(() => badge.classList.remove("is-bump"), 560);
}

function animateToCart(fromEl) {
  const badge = document.getElementById("cartBtn") || document.getElementById("cartBadge") || els.cartBtn || els.cartBadge;
  if (!fromEl || !badge) return bumpCartBadge();

  const from = fromEl.getBoundingClientRect();
  const to = badge.getBoundingClientRect();
  const dot = document.createElement("div");

  dot.className = "flyCartDot";
  dot.style.left = `${from.left + from.width / 2}px`;
  dot.style.top = `${from.top + from.height / 2}px`;
  document.body.appendChild(dot);

  dot.animate(
    [
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      {
        transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(.35)`,
        opacity: 0.25,
      },
    ],
    { duration: 560, easing: "cubic-bezier(.2,.8,.2,1)" }
  ).finished
    .catch(() => {})
    .finally(() => {
      dot.remove();
      bumpCartBadge();
    });
}

function skeletonCards(count = 8) {
  return Array.from(
    { length: count },
    () => `
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
  `
  ).join("");
}

function applyCardEnhancements(container) {
  if (!container) return;

  container.querySelectorAll(".card").forEach((card, index) => {
    card.classList.add("is-entering");
    card.style.setProperty("--stagger", String(index % 12));

    card.addEventListener(
      "animationend",
      () => card.classList.remove("is-entering"),
      { once: true }
    );

    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
}

function parseSort(v) {
  const [s, d] = String(v || "new_desc").split("_");
  return { sort: s || "new", dir: d === "asc" ? "asc" : "desc" };
}

function starsSmall(avg) {
  const a = Number(avg) || 0;
  return a ? `⭐ ${a.toFixed(1)}` : "⭐ —";
}

function getThumb(p){
  if (Array.isArray(p?.images) && p.images[0]) return String(p.images[0]).trim();
  return String(p?.image_url || "").trim();
}

function cardTemplate(p) {
  const img = getThumb(p);
  const imgHtml = img
    ? `<img src="${escapeHtml(img)}" alt="">`
    : `<div class="ph">Фото</div>`;

  return `
    <article class="card" data-id="${p.id}">
      <div class="card__img">
        ${imgHtml}
        <div class="card__tag">${escapeHtml(p.category)}</div>
        <div class="card__stat">
          <div class="pillStat">♥ ${Number(p.likes || 0)}</div>
          <div class="pillStat">${starsSmall(p.rating_avg)}</div>
        </div>
      </div>

      <div class="card__body">
        <h3 class="card__title">${escapeHtml(p.title)}</h3>
        <p class="card__desc">${escapeHtml(p.description)}</p>

        <div class="card__row">
          <div>
            <div class="price">${formatKZT(p.price)}</div>
            <div class="mini">В наличии: ${Number(p.stock) || 0}</div>
          </div>
          <button class="btn btn--primary" type="button" data-add>В корзину</button>
        </div>
      </div>
    </article>
  `;
}

function applyFilterSort() {
  const q = state.q.trim().toLowerCase();

  let list = baseList.slice();

  if (q) {
    list = list.filter(
      (p) =>
        String(p.title || "").toLowerCase().includes(q) ||
        String(p.description || "").toLowerCase().includes(q) ||
        String(p.category || "").toLowerCase().includes(q)
    );
  }

  const { sort, dir } = parseSort(state.sort);

  if (sort === "price") {
    list.sort(
      (a, b) =>
        (Number(a.price || 0) - Number(b.price || 0)) *
        (dir === "asc" ? 1 : -1)
    );
  } else if (sort === "likes") {
    list.sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0));
  } else if (sort === "rating") {
    list.sort((a, b) => Number(b.rating_avg || 0) - Number(a.rating_avg || 0));
  } else {
    list.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  }

  return list;
}

function render() {
  const list = applyFilterSort();
  if (els.meta) els.meta.textContent = `Товаров: ${list.length}`;

  if (!list.length) {
    if (els.grid) els.grid.innerHTML = "";
    if (els.empty) els.empty.hidden = false;
    return;
  }

  if (els.empty) els.empty.hidden = true;

  if (window.ProductCard?.template && els.grid) {
    els.grid.innerHTML = list.map((p) => window.ProductCard.template(p, new Set())).join("");
    window.ProductCard.bindClicks(els.grid, (id) => {
      addToCart(id);
      const btn = els.grid.querySelector(`.card[data-id="${id}"] [data-add]`);
      if (btn) animateToCart(btn);
    });
  } else if (els.grid) {
    els.grid.innerHTML = list.map(cardTemplate).join("");
    els.grid.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-add]")) return;
        location.href = `product.html?id=${card.dataset.id}`;
      });
    });

    els.grid.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        addToCart(btn.closest(".card").dataset.id);
        animateToCart(btn);
      });
    });
  }

  applyCardEnhancements(els.grid);
}

async function loadFavorites() {
  if (!token()) {
    location.href = "login.html";
    return;
  }

  const res = await MarketAPI.apiFetch("/api/favorites");
  if (!res.ok) {
    location.href = "login.html";
    return;
  }

  const data = await res.json().catch(() => []);
  const raw = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
  if (window.ProductNormalizer?.normalizeList) {
    baseList = window.ProductNormalizer.normalizeList(raw);
  } else {
    baseList = raw;
  }
  render();
}

els.search?.addEventListener("input", () => {
  state.q = els.search.value;
  render();
});

els.clear?.addEventListener("click", () => {
  els.search.value = "";
  state.q = "";
  render();
});

els.sort?.addEventListener("change", () => {
  state.sort = els.sort.value;
  render();
});

(document.getElementById("cartBtn") || els.cartBtn)?.addEventListener("click", () => {
  location.href = token() ? "cart.html" : "login.html";
});

(document.getElementById("profileBtn") || els.profileBtn)?.addEventListener("click", () => {
  location.href = token() ? "profile.html" : "login.html";
});

els.goCatalogBtn?.addEventListener("click", () => {
  location.href = "index.html";
});

window.addEventListener("storage", (e) => {
  if (e.key === Cart?.CART_KEY || e.key === "market_cart") updateCartBadge();
});

window.addEventListener("market:cart-changed", updateCartBadge);

updateCartBadge();
if (els.grid) els.grid.innerHTML = skeletonCards(8);
loadFavorites();
