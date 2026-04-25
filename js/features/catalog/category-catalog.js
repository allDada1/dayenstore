// js/features/category-catalog.js

(function () {
  function createCategoryCatalogFeature() {
    let deps = null;

    function getEls() { return deps?.els || {}; }
    function getState() { return deps?.state || {}; }
    function getLikedIds() { return typeof deps?.getLikedIds === "function" ? deps.getLikedIds() : new Set(); }
    function skeletonCards(count = 8) { return typeof deps?.skeletonCards === "function" ? deps.skeletonCards(count) : ""; }
    function applyCardEnhancements(container) { if (typeof deps?.applyCardEnhancements === "function") deps.applyCardEnhancements(container); }
    function addToCart(id) { if (typeof deps?.addToCart === "function") deps.addToCart(id); }
    function toggleFavorite(id, btn) { if (typeof deps?.toggleFavorite === "function") deps.toggleFavorite(id, btn); }

    function normalizeProduct(raw) {
      const p = raw && typeof raw === "object" ? raw : {};
      const images = Array.isArray(p.images) ? p.images.map((x) => String(x || "").trim()).filter(Boolean) : [];
      const imageUrl = String(p.image_url || "").trim();

      return {
        ...p,
        id: Number(p.id) || 0,
        title: String(p.title || "").trim(),
        description: String(p.description || "").trim(),
        category: String(p.category || "").trim(),
        price: Number(p.price) || 0,
        stock: Number(p.stock) || 0,
        likes: Number(p.likes) || 0,
        rating_avg: Number(p.rating_avg) || 0,
        rating_count: Number(p.rating_count) || 0,
        image_url: images[0] || imageUrl,
        images,
        is_liked: !!p.is_liked,
      };
    }

    async function requestJson(url) {
      if (window.MarketAPI?.get) return await window.MarketAPI.get(url);
      if (window.MarketAPI?.apiFetch) {
        const res = await window.MarketAPI.apiFetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json().catch(() => []);
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json().catch(() => []);
    }

    function setMeta(text) {
      const els = getEls();
      if (els.meta) els.meta.textContent = text || "";
    }

    function setCategoryHero() {
      const els = getEls();
      const state = getState();

      const title = state.cat === "Все"
        ? (state.sectionMode ? "Все товары раздела" : "Каталог")
        : state.cat;

      if (els.catTitle) els.catTitle.textContent = title;

      if (els.catSub) {
        if (state.sectionMode && state.cat !== "Все") {
          els.catSub.textContent = "Подборка товаров внутри выбранного раздела";
        } else if (state.cat === "Все") {
          els.catSub.textContent = "Все доступные товары в этой подборке";
        } else {
          els.catSub.textContent = "Подборка товаров по выбранной категории";
        }
      }
    }

    function normalizeProductsResponse(data) {
      const rawItems = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.products)
            ? data.products
            : [];

      return rawItems.map(normalizeProduct);
    }

    async function apiGetAllProducts() {
      return normalizeProductsResponse(await requestJson("/api/products"));
    }

    async function apiGetCategoryRows() {
      try {
        const rows = await requestJson("/api/categories");
        return Array.isArray(rows) ? rows : [];
      } catch {
        return [];
      }
    }

    async function apiGetProducts() {
      const state = getState();
      const q = String(state.q || "").trim().toLowerCase();

      if (state.sectionMode) {
  const list = await apiGetAllProducts();
  const allowed = new Set((deps.allowedCategories || []).map((name) => String(name || "").trim()));
  const selectedCat = String(state.cat || "Все").trim();

  return list.filter((item) => {
    const itemCategory = String(item.category || "").trim();
    const inSection = !allowed.size || allowed.has(itemCategory);
    if (!inSection) return false;

    if (selectedCat !== "Все" && itemCategory !== selectedCat) return false;

    if (!q) return true;

    const hay = [item.title, item.description, item.category]
      .map((v) => String(v || "").toLowerCase())
      .join(" ");

    return hay.includes(q);
  });
}

      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (state.cat && state.cat !== "Все") sp.set("cat", state.cat);

      const url = "/api/products" + (sp.toString() ? `?${sp.toString()}` : "");
      return normalizeProductsResponse(await requestJson(url));
    }

    async function loadCategories() {
      const state = getState();
      const [list, rows] = await Promise.all([apiGetAllProducts(), apiGetCategoryRows()]);

      deps.categoryRows = rows;

      const normalizedCat = String(state.cat || "Все").trim();
      const sectionRows = rows.filter((row) => String(row?.section || "").trim() === normalizedCat);

      if (normalizedCat !== "Все" && sectionRows.length) {
        deps.allowedCategories = Array.from(
          new Set(sectionRows.map((row) => String(row?.title || "").trim()).filter(Boolean))
        );
        deps.allCategories = ["Все", ...deps.allowedCategories];
        state.sectionMode = true;
      } else {
        const cats = Array.from(new Set(list.map((x) => x.category).filter(Boolean)));
        deps.allowedCategories = cats;
        deps.allCategories = ["Все", ...cats];
        state.sectionMode = false;
      }

      renderChips();
      setCategoryHero();
    }

    function renderChips() {
      const els = getEls();
      const state = getState();

      if (!els.chips) return;

      els.chips.innerHTML = "";

      (deps.allCategories || ["Все"]).forEach((cat) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (cat === state.cat ? " is-active" : "");
        b.textContent = cat;

        b.addEventListener("click", () => {
          state.cat = cat;
          renderChips();
          setCategoryHero();
          renderProducts();
        });

        els.chips.appendChild(b);
      });
    }

    function bindGrid(container) {
      if (!container || !window.ProductCard) return;

      const addToCartWithAnimation = (id, btn) => {
        addToCart(id);
        if (btn && typeof deps?.animateToCart === "function") deps.animateToCart(btn);
      };

      container.querySelectorAll(".card").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-add]") || e.target.closest("[data-fav]")) return;
          location.href = `product.html?id=${card.dataset.id}`;
        });
      });

      container.querySelectorAll("[data-add]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.closest(".card")?.dataset?.id;
          if (!id) return;
          addToCartWithAnimation(id, btn);
        });
      });

      container.querySelectorAll("[data-fav]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.closest(".card")?.dataset?.id;
          if (!id) return;
          toggleFavorite(id, btn);
        });
      });

      applyCardEnhancements(container);
    }

    async function renderProducts() {
      const els = getEls();
      const state = getState();

      try {
        if (els.grid) els.grid.innerHTML = skeletonCards(8);

        const list = await apiGetProducts();

        if (state.q) {
          setMeta(`Найдено товаров: ${list.length}`);
        } else {
          setMeta(`Товаров: ${list.length}`);
        }

        if (!list.length) {
          if (els.grid) els.grid.innerHTML = "";
          if (els.empty) els.empty.hidden = false;
          return;
        }

        if (els.empty) els.empty.hidden = true;

        els.grid.innerHTML = list
          .map((p) => window.ProductCard.template(p, getLikedIds()))
          .join("");

        bindGrid(els.grid);
      } catch (err) {
        console.error(err);
        if (els.grid) els.grid.innerHTML = "";
        if (els.empty) els.empty.hidden = false;
        setMeta("Ошибка загрузки");
      }
    }

    function getCatFromUrl() {
      const sp = new URLSearchParams(location.search);
      const cat = sp.get("cat");
      return cat ? String(cat) : "Все";
    }

    function init(options) {
      deps = {
        ...(options || {}),
        allCategories: ["Все"],
        allowedCategories: [],
        categoryRows: [],
      };

      const state = getState();
      state.cat = getCatFromUrl() || "Все";
      state.sectionMode = false;

      setCategoryHero();
    }

    return {
      init,
      loadCategories,
      renderChips,
      renderProducts,
      setCategoryHero
    };
  }

  window.CategoryCatalogFeature = createCategoryCatalogFeature();
})();