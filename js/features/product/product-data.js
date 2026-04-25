// js/features/product-data.js

(function () {
  function createProductDataFeature() {
    const Utils = window.MarketUtils || {};
    const Cart = window.MarketStorage;
    const Normalizer = window.ProductNormalizer || {};
    const RECENTLY_VIEWED_KEY = "market_recent_products_v1";
    const RECENTLY_VIEWED_LIMIT = 10;

    function formatKZT(value) {
      return Utils.formatKZT ? Utils.formatKZT(value) : `${Math.round(Number(value) || 0)} ₸`;
    }

    function escapeHtml(v) {
      return Utils.escapeHtml ? Utils.escapeHtml(v) : String(v ?? "");
    }

    function token() {
      return Utils.getToken ? Utils.getToken() : (window.MarketAPI?.getToken?.() || "");
    }

    function getId() {
      if (Utils.getQueryParam) return Number(Utils.getQueryParam("id"));
      const sp = new URLSearchParams(location.search);
      return Number(sp.get("id"));
    }

    function addToCart(id) {
      if (Utils.addToCart) {
        Utils.addToCart(id, 1, "cartBadge", { hideWhenZero: true });
      } else if (Cart?.addToCart) {
        Cart.addToCart(id, 1);
      } else {
        let cart = {};
        try { cart = JSON.parse(localStorage.getItem("market_cart") || "{}"); } catch { cart = {}; }
        const k = String(id);
        cart[k] = (Number(cart[k]) || 0) + 1;
        localStorage.setItem("market_cart", JSON.stringify(cart));
      }

      if (window.UI) {
        UI.toast("Товар добавлен в корзину", "success");
      }
    }

    function buildImages(p) {
      const raw = Array.isArray(p?.images) ? p.images : [];
      const clean = raw
        .map((x) => typeof x === "string" ? x : x?.image_url)
        .map((x) => String(x || "").trim())
        .filter(Boolean);

      if (p?.image_url && !clean.includes(p.image_url)) clean.unshift(String(p.image_url).trim());
      return clean.filter(Boolean);
    }

    async function loadSeller(id) {
      if (!id) return null;
      const res = await fetch(`/api/sellers/${id}`);
      if (!res.ok) return null;
      return await res.json();
    }

    function normalizeOne(payload) {
      if (typeof Normalizer.normalizeProduct === "function") {
        if (payload?.product && typeof payload.product === "object") {
          return Normalizer.normalizeProduct(payload.product);
        }
        return Normalizer.normalizeProduct(payload);
      }
      return payload?.product && typeof payload.product === "object" ? payload.product : payload;
    }

    function normalizeMany(payload) {
      const raw = typeof Normalizer.extractItems === "function"
        ? Normalizer.extractItems(payload)
        : (Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : []);

      if (typeof Normalizer.normalizeList === "function") {
        return Normalizer.normalizeList(raw);
      }
      return Array.isArray(raw) ? raw : [];
    }

    async function loadProduct(id) {
      const res = await MarketAPI.apiFetch(`/api/products/${id}`);
      if (!res.ok) return null;

      const payload = await res.json().catch(() => null);
      const product = normalizeOne(payload);
      if (!product || !product.id) return null;

      if (window.Recommendations) {
        Recommendations.track(product.id);
      }

      return product;
    }

    async function loadCatalogByCategory(cat) {
      const url = cat ? `/api/products?cat=${encodeURIComponent(cat)}` : `/api/products`;
      const res = await MarketAPI.apiFetch(url);
      if (!res.ok) return [];
      const payload = await res.json().catch(() => []);
      return normalizeMany(payload);
    }

    async function loadSimilar(cat, currentId) {
      const rows = await loadCatalogByCategory(cat);
      return rows.filter((x) => Number(x.id) !== Number(currentId)).slice(0, 4);
    }

    function normalizeRecentProduct(p) {
      return {
        id: Number(p.id),
        title: String(p.title || ""),
        price: Number(p.price || 0),
        image_url: String(p.image_url || ""),
        images: Array.isArray(p.images) ? p.images : [],
        category: String(p.category || ""),
        rating_avg: Number(p.rating_avg || 0),
        stock: Number(p.stock || 0),
      };
    }

    function saveRecentlyViewedProduct(p) {
      if (!p || !p.id) return;

      let items = [];
      try {
        items = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]");
      } catch {
        items = [];
      }

      const normalized = normalizeRecentProduct(p);
      items = Array.isArray(items) ? items : [];
      items = items.filter((item) => Number(item?.id) !== Number(normalized.id));
      items.unshift(normalized);

      if (items.length > RECENTLY_VIEWED_LIMIT) {
        items = items.slice(0, RECENTLY_VIEWED_LIMIT);
      }

      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(items));
    }

    function getRecentlyViewedProducts(currentId) {
      let items = [];
      try {
        items = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]");
      } catch {
        items = [];
      }

      items = Array.isArray(items) ? items : [];
      return items
        .filter((item) => item && Number(item.id) !== Number(currentId))
        .slice(0, 8);
    }

    function pickBoughtTogetherProducts(currentProduct, allRows) {
      if (!currentProduct || !Array.isArray(allRows)) return [];

      const currentId = Number(currentProduct.id);
      const currentCategory = String(currentProduct.category || "").trim();
      const currentSection = String(currentProduct.section || "").trim();
      const currentPrice = Number(currentProduct.price || 0);

      return allRows
        .filter((item) => Number(item.id) !== currentId)
        .map((item) => {
          let score = 0;

          if (String(item.category || "").trim() === currentCategory) score += 4;
          if (String(item.section || "").trim() === currentSection && currentSection) score += 2;
          if (Number(item.stock || 0) > 0) score += 1;
          if (Math.abs(Number(item.price || 0) - currentPrice) <= Math.max(1000, currentPrice * 0.35)) score += 1;
          score += Math.min(2, Number(item.rating_avg || 0) / 3);

          return { ...item, __score: score };
        })
        .sort((a, b) => {
          if (b.__score !== a.__score) return b.__score - a.__score;
          if (Number(b.rating_avg || 0) !== Number(a.rating_avg || 0)) return Number(b.rating_avg || 0) - Number(a.rating_avg || 0);
          return Number(b.id || 0) - Number(a.id || 0);
        })
        .slice(0, 4);
    }

    return {
      formatKZT,
      escapeHtml,
      token,
      getId,
      addToCart,
      buildImages,
      loadSeller,
      loadProduct,
      loadCatalogByCategory,
      loadSimilar,
      saveRecentlyViewedProduct,
      getRecentlyViewedProducts,
      pickBoughtTogetherProducts
    };
  }

  window.ProductDataFeature = createProductDataFeature();
})();