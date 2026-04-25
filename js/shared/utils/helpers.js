// js/utils.js
// Единое ядро общих helper-функций.
// Без зависимостей, но умеет использовать Auth / MarketStorage, если они уже загружены.

(function (global) {
  const TOKEN_FALLBACK_KEYS = [
    "market_token",
    "token",
    "auth_token",
    "authToken",
    "marketToken",
    "admin_token",
  ];

  const CART_KEY = "market_cart";

  function safeParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  // =========================
  // TEXT / FORMAT
  // =========================
  function formatKZT(value) {
    const n = Math.round(Number(value) || 0);
    return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // =========================
  // URL
  // =========================
  function getQueryParam(name) {
    const sp = new URLSearchParams(global.location.search || "");
    const v = sp.get(name);
    return v == null ? "" : String(v);
  }

  // =========================
  // TOKEN / SESSION HELPERS
  // =========================
  function getToken() {
    try {
      if (global.Auth && typeof global.Auth.getToken === "function") {
        return global.Auth.getToken() || "";
      }
    } catch {}

    for (const key of TOKEN_FALLBACK_KEYS) {
      try {
        const value = global.localStorage.getItem(key);
        if (value) return value;
      } catch {}
    }

    return "";
  }

  function setToken(token) {
    try {
      if (global.Auth && typeof global.Auth.setToken === "function") {
        global.Auth.setToken(token || "");
        return;
      }
    } catch {}

    try {
      if (!token) {
        global.localStorage.removeItem("market_token");
      } else {
        global.localStorage.setItem("market_token", String(token));
      }
    } catch {}
  }

  function isLoggedIn() {
    return !!getToken();
  }

  // =========================
  // CART HELPERS
  // =========================
  function loadCartFallback() {
    try {
      return safeParse(global.localStorage.getItem(CART_KEY) || "{}", {});
    } catch {
      return {};
    }
  }

  function normalizeQty(value) {
    const n = Math.floor(Number(value) || 0);
    return n > 0 ? n : 0;
  }

  function normalizeCart(input) {
    const src =
      input && typeof input === "object" && !Array.isArray(input) ? input : {};

    const out = {};
    for (const [key, value] of Object.entries(src)) {
      const qty = normalizeQty(value);
      if (qty > 0) out[String(key)] = qty;
    }
    return out;
  }

  function loadCart() {
    try {
      if (global.MarketStorage && typeof global.MarketStorage.getCart === "function") {
        return global.MarketStorage.getCart();
      }
    } catch {}

    return normalizeCart(loadCartFallback());
  }

  function saveCart(cart) {
    const normalized = normalizeCart(cart);

    try {
      if (global.MarketStorage && typeof global.MarketStorage.setCart === "function") {
        return global.MarketStorage.setCart(normalized);
      }
    } catch {}

    try {
      global.localStorage.setItem(CART_KEY, JSON.stringify(normalized));
    } catch {}

    try {
      global.dispatchEvent(
        new CustomEvent("market:cart-changed", {
          detail: {
            cart: normalized,
            count: cartCount(normalized),
          },
        })
      );
    } catch {}

    return normalized;
  }

  function cartCount(cart) {
    const src = cart || loadCart();
    return Object.values(src).reduce((sum, qty) => sum + normalizeQty(qty), 0);
  }

  function getCartCount() {
    try {
      if (global.MarketStorage && typeof global.MarketStorage.getCartCount === "function") {
        return global.MarketStorage.getCartCount();
      }
    } catch {}

    return cartCount(loadCart());
  }

  function setCartQty(productId, qty) {
    const key = String(productId);

    try {
      if (global.MarketStorage && typeof global.MarketStorage.setCartQty === "function") {
        return global.MarketStorage.setCartQty(key, qty);
      }
    } catch {}

    const cart = loadCart();
    const n = normalizeQty(qty);

    if (n > 0) cart[key] = n;
    else delete cart[key];

    return saveCart(cart);
  }

  function addToCart(productId, qty = 1, badgeElOrId, opts) {
    const key = String(productId);

    try {
      if (global.MarketStorage && typeof global.MarketStorage.addToCart === "function") {
        global.MarketStorage.addToCart(key, qty);
      } else {
        const cart = loadCart();
        cart[key] = normalizeQty(cart[key]) + normalizeQty(qty || 1);
        saveCart(cart);
      }
    } catch {
      const cart = loadCart();
      cart[key] = normalizeQty(cart[key]) + normalizeQty(qty || 1);
      saveCart(cart);
    }

    if (badgeElOrId) {
      updateCartBadge(badgeElOrId, opts);
    }
  }

  function removeFromCart(productId) {
    const key = String(productId);

    try {
      if (global.MarketStorage && typeof global.MarketStorage.removeFromCart === "function") {
        return global.MarketStorage.removeFromCart(key);
      }
    } catch {}

    const cart = loadCart();
    delete cart[key];
    return saveCart(cart);
  }

  function clearCart() {
    try {
      if (global.MarketStorage && typeof global.MarketStorage.clearCart === "function") {
        return global.MarketStorage.clearCart();
      }
    } catch {}

    return saveCart({});
  }

  function updateCartBadge(badgeElOrId, opts) {
    const options = opts || {};
    const el =
      typeof badgeElOrId === "string"
        ? global.document.getElementById(badgeElOrId)
        : badgeElOrId;

    if (!el) return;

    const count = getCartCount();
    el.textContent = String(count);

    if (options.hideWhenZero) {
      el.hidden = count <= 0;
    }
  }

  // =========================
  // THEME / LANG
  // =========================
  function applyTheme(theme) {
    const t = (theme || global.localStorage.getItem("market_theme") || "").toLowerCase();
    const v = (t === "light" || t === "dark") ? t : "dark";
    global.document.documentElement.dataset.theme = v;
    global.localStorage.setItem("market_theme", v);
    return v;
  }

  function applyLang(lang) {
    const l = (lang || global.localStorage.getItem("market_lang") || "").toLowerCase();
    const v = ["ru", "kz", "en"].includes(l) ? l : "ru";
    global.document.documentElement.dataset.lang = v;
    global.localStorage.setItem("market_lang", v);
    return v;
  }

  // =========================
  // EXPOSE
  // =========================
  const MarketUtils = {
    TOKEN_FALLBACK_KEYS,
    CART_KEY,

    safeParse,

    formatKZT,
    escapeHtml,
    getQueryParam,

    getToken,
    setToken,
    isLoggedIn,

    loadCart,
    saveCart,
    cartCount,
    getCartCount,
    setCartQty,
    addToCart,
    removeFromCart,
    clearCart,
    updateCartBadge,

    applyTheme,
    applyLang,
  };

  global.MarketUtils = MarketUtils;

  // =========================
  // LEGACY GLOBALS
  // =========================
  if (typeof global.formatKZT !== "function") global.formatKZT = formatKZT;
  if (typeof global.escapeHtml !== "function") global.escapeHtml = escapeHtml;
  if (typeof global.getQueryParam !== "function") global.getQueryParam = getQueryParam;

  if (typeof global.getToken !== "function") global.getToken = getToken;

  if (typeof global.loadCart !== "function") global.loadCart = loadCart;
  if (typeof global.saveCart !== "function") global.saveCart = saveCart;
  if (typeof global.updateCartBadge !== "function") {
    global.updateCartBadge = function () {
      const badge = global.document.getElementById("cartBadge");
      updateCartBadge(badge, { hideWhenZero: false });
    };
  }
  if (typeof global.addToCart !== "function") {
    global.addToCart = function (productId, badgeElOrId, opts) {
      return addToCart(productId, 1, badgeElOrId, opts);
    };
  }

  if (typeof global.applyTheme !== "function") global.applyTheme = applyTheme;
  if (typeof global.applyLang !== "function") global.applyLang = applyLang;
})(window);

try {
  window.MarketUtils?.applyTheme();
  window.MarketUtils?.applyLang();
} catch {}