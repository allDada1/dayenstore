// js/core/storage.js
// Единый источник правды для корзины в localStorage.
// Корзина гостя и корзины пользователей хранятся раздельно.

(function (global) {
  const CART_KEY = "market_cart";
  const CART_GUEST_KEY = `${CART_KEY}__guest`;
  const CART_USER_PREFIX = `${CART_KEY}__user_`;

  function safeParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
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

  function getCurrentUserId() {
    try {
      if (global.Auth?.getSession) {
        const session = global.Auth.getSession();
        const id = session?.id;
        if (id != null && id !== "") return String(id);
      }
    } catch {}

    return "";
  }

  function getCartKey(userId) {
    const uid = String(userId || getCurrentUserId() || "").trim();
    return uid ? `${CART_USER_PREFIX}${uid}` : CART_GUEST_KEY;
  }

  function readCartByKey(key) {
    try {
      const raw = global.localStorage.getItem(key);
      const parsed = raw ? safeParse(raw, {}) : {};
      return normalizeCart(parsed);
    } catch {
      return {};
    }
  }

  function writeCartByKey(key, cartObj) {
    const normalized = normalizeCart(cartObj);
    global.localStorage.setItem(key, JSON.stringify(normalized));
    return normalized;
  }

  function emitCartChanged() {
    try {
      global.dispatchEvent(
        new CustomEvent("market:cart-changed", {
          detail: {
            key: getCartKey(),
            cart: getCart(),
            count: getCartCount(),
            userId: getCurrentUserId() || null,
          },
        })
      );
    } catch {}
  }

  function getCart() {
    return readCartByKey(getCartKey());
  }

  function setCart(cartObj) {
    const normalized = writeCartByKey(getCartKey(), cartObj);
    emitCartChanged();
    return normalized;
  }

  function getCartCount() {
    const cart = getCart();
    let total = 0;
    for (const qty of Object.values(cart)) {
      total += normalizeQty(qty);
    }
    return total;
  }

  function setCartQty(productId, qty) {
    const cart = getCart();
    const key = String(productId);
    const normalizedQty = normalizeQty(qty);

    if (normalizedQty > 0) cart[key] = normalizedQty;
    else delete cart[key];

    return setCart(cart);
  }

  function addToCart(productId, qty = 1) {
    const key = String(productId);
    const cart = getCart();
    const nextQty = normalizeQty(cart[key]) + normalizeQty(qty);
    return setCartQty(key, nextQty);
  }

  function removeFromCart(productId) {
    const cart = getCart();
    delete cart[String(productId)];
    return setCart(cart);
  }

  function clearCart() {
    return setCart({});
  }

  global.MarketStorage = {
    CART_KEY,
    CART_GUEST_KEY,
    CART_USER_PREFIX,
    getCartKey,
    getCart,
    setCart,
    getCartCount,
    setCartQty,
    addToCart,
    removeFromCart,
    clearCart,
  };
})(window);