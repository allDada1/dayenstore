// js/features/catalog.js

(function () {
  function createCatalogFeature() {
    let deps = null;
    let paging = {
      limit: 25,
      offset: 0,
      total: 0,
      hasMore: true,
      loading: false,
      observer: null,
      sentinel: null,
      button: null
    };

    function getState() { return deps?.state || {}; }
    function getEls() { return deps?.els || {}; }
    function getLikedIds() { return typeof deps?.getLikedIds === "function" ? deps.getLikedIds() : new Set(); }
    function skeletonCards(count = 8) { return typeof deps?.skeletonCards === "function" ? deps.skeletonCards(count) : ""; }
    function applyCardEnhancements(container) { if (typeof deps?.applyCardEnhancements === "function") deps.applyCardEnhancements(container); }
    function addToCart(id) { if (typeof deps?.addToCart === "function") deps.addToCart(id); }
    function toggleFavorite(id, btn) { if (typeof deps?.toggleFavorite === "function") deps.toggleFavorite(id, btn); }

    function normalizeProduct(raw) {
      const p = raw && typeof raw === 'object' ? raw : {};
      const images = Array.isArray(p.images) ? p.images.map((x) => String(x || '').trim()).filter(Boolean) : [];
      const imageUrl = String(p.image_url || '').trim();
      return {
        ...p,
        id: Number(p.id) || 0,
        title: String(p.title || '').trim(),
        description: String(p.description || '').trim(),
        category: String(p.category || '').trim(),
        price: Number(p.price) || 0,
        stock: Number(p.stock) || 0,
        likes: Number(p.likes) || 0,
        rating_avg: Number(p.rating_avg) || 0,
        rating_count: Number(p.rating_count) || 0,
        image_url: images[0] || imageUrl,
        images,
        seller_id: Number(p.seller_id || p.owner_user_id) || 0,
        owner_user_id: Number(p.owner_user_id) || 0,
        seller_name: String(p.seller_name || p.seller_nickname || p.seller || '').trim(),
        seller_nickname: String(p.seller_nickname || '').trim(),
        is_liked: !!p.is_liked,
        my_rating: p.my_rating ?? null,
      };
    }

    function normalizeProductsResponse(data) {
      const rawItems = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.products)
            ? data.products
            : Array.isArray(data?.rows)
              ? data.rows
              : [];

      const items = rawItems.map(normalizeProduct);
      const total = Number(data?.total);
      const limit = Number(data?.limit);
      const offset = Number(data?.offset);
      const hasMore = data?.has_more;

      return {
        items,
        total: Number.isFinite(total) ? total : items.length,
        limit: Number.isFinite(limit) ? limit : paging.limit,
        offset: Number.isFinite(offset) ? offset : 0,
        has_more: typeof hasMore === 'boolean' ? hasMore : false
      };
    }

    function parseSort(v) {
      const [s, d] = String(v || "new_desc").split("_");
      return { sort: s || "new", dir: d === "asc" ? "asc" : "desc" };
    }

    async function requestJson(url) {
      if (window.MarketAPI && typeof window.MarketAPI.get === "function") return await window.MarketAPI.get(url);
      if (window.MarketAPI && typeof window.MarketAPI.apiFetch === "function") {
        const res = await window.MarketAPI.apiFetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json().catch(() => []);
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json().catch(() => []);
    }

    function setMeta(text) { const els = getEls(); if (els.meta) els.meta.textContent = text || ""; }
    function hideEmpty() { const els = getEls(); if (els.empty) els.empty.hidden = true; }
    function showEmpty() { const els = getEls(); if (els.empty) els.empty.hidden = false; }

    async function apiGetProducts() {
      const state = getState();
      const { sort, dir } = parseSort(state.sort);
      const params = new URLSearchParams();
      if (String(state.q || "").trim()) params.set("q", String(state.q).trim());
      if (state.cat && state.cat !== "Все") params.set("cat", state.cat);
      if (sort) params.set("sort", sort);
      if (dir) params.set("dir", dir);
      params.set("limit", String(paging.limit));
      params.set("offset", String(paging.offset));
      const url = `/api/products?${params.toString()}`;
      try { return normalizeProductsResponse(await requestJson(url)); }
      catch (e) {
        console.error("apiGetProducts error:", e, url);
        return { items: [], total: 0, limit: paging.limit, offset: paging.offset, has_more: false };
      }
    }

    async function apiGetAllProducts() {
      try { return normalizeProductsResponse(await requestJson('/api/products')).items; }
      catch (e) { console.error('apiGetAllProducts error:', e); return []; }
    }

    function renderChips() {
      const els = getEls();
      const state = getState();
      if (!els.chips) return;
      els.chips.innerHTML = "";
      (deps.allCategories || ["Все"]).forEach(cat => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip' + (cat === state.cat ? ' is-active' : '');
        b.textContent = cat;
        b.addEventListener('click', () => {
          state.cat = cat;
          renderChips();
          updatePopularVisibility();
          renderProducts({ reset: true });
        });
        els.chips.appendChild(b);
      });
    }

    async function loadCategories() {
      const els = getEls();
      try {
        const rows = await requestJson('/api/category-groups');
        if (!Array.isArray(rows) || !rows.length) {
          const list = await apiGetAllProducts();
          const cats = Array.from(new Set(list.map(x => x.category).filter(Boolean)));
          deps.allCategories = ['Все', ...cats];
          renderChips();
          return;
        }
        const groups = rows.map(r => r.group_name).filter(Boolean);
        deps.allCategories = ['Все', ...groups];
        renderChips();
        if (els.chips) els.chips.dataset.ready = '1';
      } catch (e) {
        console.error('loadCategories error:', e);
        const list = await apiGetAllProducts();
        const cats = Array.from(new Set(list.map(x => x.category).filter(Boolean)));
        deps.allCategories = ['Все', ...cats];
        renderChips();
      }
    }

    function bindNewCards(root) {
      if (!root || !window.ProductCard) return;
      window.ProductCard.bindClicks(root, addToCart, toggleFavorite);
      applyCardEnhancements(root);
    }

    function appendCards(items) {
      const els = getEls();
      if (!els.grid || !Array.isArray(items) || !items.length) return;
      bindNewCards(els.grid);
      const html = items.map(p => window.ProductCard.template(p, getLikedIds())).join('');
      els.grid.insertAdjacentHTML('beforeend', html);
      applyCardEnhancements(els.grid);
    }

    function ensurePagingUi() {
      const els = getEls(); if (!els.grid) return;
      let sentinel = document.getElementById('catalogInfiniteSentinel');
      if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'catalogInfiniteSentinel';
        sentinel.style.width = '100%';
        sentinel.style.height = '1px';
        sentinel.style.pointerEvents = 'none';
        els.grid.after(sentinel);
      }
      paging.sentinel = sentinel;

      let button = document.getElementById('catalogLoadMoreBtn');
      if (!button) {
        button = document.createElement('button');
        button.id = 'catalogLoadMoreBtn';
        button.type = 'button';
        button.className = 'btn btn--ghost';
        button.textContent = 'Показать ещё';
        button.addEventListener('click', () => { loadMoreProducts(); });
        sentinel.after(button);
      }
      paging.button = button;
    }

    function destroyObserver() { if (paging.observer) { try { paging.observer.disconnect(); } catch {} } paging.observer = null; }
    function updatePagingUi() {
      ensurePagingUi();
      const show = paging.hasMore && !paging.loading;
      if (paging.button) {
        paging.button.style.display = show ? 'block' : 'none';
        paging.button.disabled = paging.loading;
        paging.button.textContent = paging.loading ? 'Загрузка...' : 'Показать ещё';
      }
      destroyObserver();
      if (!paging.hasMore || paging.loading || !paging.sentinel) return;
    }
    function resetPaging() { paging.offset = 0; paging.total = 0; paging.hasMore = true; paging.loading = false; }

    async function renderProducts(options = {}) {
      const els = getEls();
      const state = getState();
      const reset = options.reset !== false;
      try {
        if (!els.grid) return console.error('productsGrid container not found');
        if (reset) { resetPaging(); els.grid.innerHTML = skeletonCards(8); }
        paging.loading = true; updatePagingUi();
        const page = await apiGetProducts();
        const items = Array.isArray(page.items) ? page.items : [];
        paging.total = Number(page.total || 0);
        paging.hasMore = !!page.has_more;
        setMeta(state.q ? `Найдено товаров: ${paging.total}` : `Товаров: ${paging.total}`);
        if (reset) els.grid.innerHTML = '';
        if (!items.length && reset) { showEmpty(); updatePagingUi(); return; }
        hideEmpty(); appendCards(items);
        paging.offset += items.length; paging.loading = false; updatePagingUi();
      } catch (err) {
        paging.loading = false; updatePagingUi();
        console.error('renderProducts error:', err); setMeta('Ошибка загрузки');
      }
    }

    async function loadMoreProducts() { if (paging.loading || !paging.hasMore) return; await renderProducts({ reset: false }); }
    function updatePopularVisibility() {
      const els = getEls(); const state = getState();
      const show = String(state.q || '').trim().length === 0 && state.cat === 'Все';
      if (els.popularWrap) els.popularWrap.hidden = !show;
    }

    async function renderPopular() {
      const els = getEls();
      if (!els.popularWrap || !els.popularLiked || !els.popularRated) return;
      try {
        const list = await apiGetAllProducts();
        updatePopularVisibility();
        const topLikes = list.slice().sort((a,b)=>Number(b.likes||0)-Number(a.likes||0)).slice(0,10);
        const topRated = list.slice().sort((a,b)=>{
          const ac = Number(a.rating_count||0); const bc = Number(b.rating_count||0);
          if (bc !== ac) return bc - ac;
          return Number(b.rating_avg||0) - Number(a.rating_avg||0);
        }).slice(0,10);
        els.popularLiked.innerHTML = topLikes.map(p => window.ProductCard.template(p, getLikedIds())).join('');
        els.popularRated.innerHTML = topRated.map(p => window.ProductCard.template(p, getLikedIds())).join('');
        bindNewCards(els.popularLiked); bindNewCards(els.popularRated);
      } catch (e) { console.error('renderPopular error:', e); }
    }

    async function previewProducts(q) {
      const text = String(q || '').trim(); if (!text) return [];
      try { return normalizeProductsResponse(await requestJson(`/api/products?q=${encodeURIComponent(text)}&limit=8&offset=0`)).items; }
      catch (e) { console.error('previewProducts error:', e); return []; }
    }

    function init(options) { deps = { ...options, allCategories: ['Все'] }; ensurePagingUi(); }

    return { init, loadCategories, renderChips, renderProducts, loadMoreProducts, renderPopular, updatePopularVisibility, previewProducts, apiGetProducts, apiGetAllProducts, resetPaging };
  }
  window.HomeCatalog = createCatalogFeature();
})();
