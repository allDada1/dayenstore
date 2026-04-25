const el = {
  list: document.getElementById("cartList"),
  total: document.getElementById("cartTotal"),
  clear: document.getElementById("clearCartBtn"),
  toCheckout: document.getElementById("toCheckoutBtn"),
  note: document.getElementById("cartNote"),
  itemsCount: document.getElementById("cartItemsCount"),
  itemsMeta: document.getElementById("cartItemsMeta"),
};

const Cart = window.MarketStorage;
const ProductNormalizer = window.ProductNormalizer || {};

function formatKZT(value) {
  const s = String(Math.round(Number(value) || 0));
  return `${s.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
}
function setNote(t) { if (el.note) el.note.textContent = t || ""; }

function loadCart() {
  if (Cart?.getCart) return Cart.getCart();
  try { return JSON.parse(localStorage.getItem("market_cart") || "{}"); } catch { return {}; }
}
function saveCart(cart) {
  if (Cart?.setCart) return Cart.setCart(cart);
  localStorage.setItem("market_cart", JSON.stringify(cart));
}

function extractItems(payload) {
  if (typeof ProductNormalizer.extractItems === "function") return ProductNormalizer.extractItems(payload);
  return Array.isArray(payload) ? payload : [];
}
function normalizeList(list) {
  if (typeof ProductNormalizer.normalizeList === "function") return ProductNormalizer.normalizeList(list);
  return Array.isArray(list) ? list : [];
}

async function getProductsMap() {
  const r = await fetch("/api/products");
  const payload = await r.json().catch(() => []);
  const list = normalizeList(extractItems(payload));
  return new Map(list.map((p) => [Number(p.id), p]));
}

function emptyTemplate() {
  return `
    <div class="cartEmpty">
      <div class="cartEmpty__title">Корзина пока пустая</div>
      <div class="cartEmpty__text">Добавь товары с витрины или карточки товара, и они появятся здесь.</div>
      <div class="cartEmpty__actions">
        <a class="btn btn--primary" href="index.html">Перейти в каталог</a>
        <a class="btn" href="favorites.html">Открыть избранное</a>
      </div>
    </div>
  `;
}

function rowTemplate(p, qty) {
  const sum = (Number(p.price) || 0) * qty;
  const img = String((Array.isArray(p.images) && p.images[0]) || p.image_url || "").trim();
  const media = img ? `<img class="cartThumb" src="${img}" alt="">` : `<div class="cartThumb cartThumb--ph">Фото</div>`;
  return `
    <div class="cartItem" data-id="${p.id}">
      <div class="cartItem__left">
        ${media}
        <div class="cartItem__content">
          <div class="cartItem__t">${p.title}</div>
          <div class="cartItem__s">${p.category || "Товар"} • ${formatKZT(p.price)}</div>
        </div>
      </div>
      <div class="cartItem__right">
        <div><b>${formatKZT(sum)}</b></div>
        <div class="qtyRow">
          <button class="qtyBtn" data-dec type="button">−</button>
          <div class="qtyVal">${qty}</div>
          <button class="qtyBtn" data-inc type="button">+</button>
        </div>
      </div>
    </div>
  `;
}

async function render() {
  const cart = loadCart();
  const entries = Object.entries(cart).filter(([_, q]) => Number(q) > 0);

  if (!entries.length) {
    el.list.innerHTML = emptyTemplate();
    el.total.textContent = formatKZT(0);
    if (el.itemsCount) el.itemsCount.textContent = "0";
    if (el.itemsMeta) el.itemsMeta.textContent = "В корзине пока нет товаров";
    setNote("");
    return;
  }

  const map = await getProductsMap();

  let total = 0;
  let totalQty = 0;
  const rows = [];
  const missing = [];

  for (const [pid, qtyRaw] of entries) {
    const pidNum = Number(pid);
    const qty = Math.max(1, Number(qtyRaw) || 1);
    const p = map.get(pidNum);
    if (!p) {
      missing.push(pid);
      continue;
    }
    total += (Number(p.price) || 0) * qty;
    totalQty += qty;
    rows.push(rowTemplate(p, qty));
  }

  if (missing.length) {
    const nextCart = { ...cart };
    missing.forEach((id) => delete nextCart[id]);
    saveCart(nextCart);
    setNote("Часть товаров больше недоступна и была убрана из корзины.");
  } else {
    setNote("");
  }

  el.list.innerHTML = rows.length ? rows.join("") : emptyTemplate();
  el.total.textContent = formatKZT(total);
  if (el.itemsCount) el.itemsCount.textContent = String(totalQty);
  if (el.itemsMeta) {
    el.itemsMeta.textContent = `${rows.length} поз. • ${totalQty} шт.`;
  }

  el.list.querySelectorAll(".cartItem").forEach((item) => {
    const pid = item.dataset.id;

    item.querySelector("[data-inc]")?.addEventListener("click", () => {
      const c = loadCart();
      c[pid] = Number(c[pid] || 0) + 1;
      saveCart(c);
      render();
    });

    item.querySelector("[data-dec]")?.addEventListener("click", () => {
      const c = loadCart();
      const next = Number(c[pid] || 0) - 1;
      if (next <= 0) delete c[pid];
      else c[pid] = next;
      window.UI?.toast?.(next <= 0 ? "Товар удалён из корзины" : "Количество изменено");
      saveCart(c);
      render();
    });
  });
}

el.clear?.addEventListener("click", () => {
  if (Cart?.clearCart) Cart.clearCart();
  else localStorage.setItem("market_cart", "{}");
  window.UI?.toast?.("Корзина очищена");
  render();
});

el.toCheckout?.addEventListener("click", () => {
  const loggedIn = window.Auth?.isLoggedIn?.() || !!window.MarketAPI?.getToken?.();
  if (!loggedIn) {
    location.href = "login.html";
    return;
  }
  location.href = "checkout.html";
});

window.addEventListener("storage", (e) => {
  const key = String(e.key || "");
  const baseKey = Cart?.CART_KEY || "market_cart";
  if (key === baseKey || key.startsWith(baseKey + "__")) {
    render();
  }
});

window.addEventListener("market:cart-changed", render);
window.addEventListener("market:auth-changed", render);

render();
