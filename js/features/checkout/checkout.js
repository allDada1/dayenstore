(function () {
  const btn = document.getElementById("placeOrderBtn");
  const cityEl = document.getElementById("city");
  const addrEl = document.getElementById("address");
  const phoneEl = document.getElementById("phone");
  const commentEl = document.getElementById("checkoutComment");
  const msg = document.getElementById("checkoutMsg");
  const itemsEl = document.getElementById("checkoutItems");
  const itemsMetaEl = document.getElementById("checkoutItemsMeta");
  const subtotalEl = document.getElementById("checkoutSubtotal");
  const totalEl = document.getElementById("checkoutTotal");
  const deliveryEl = document.getElementById("checkoutDelivery");

  const Cart = window.MarketStorage;
  const ProductNormalizer = window.ProductNormalizer || {};
  const DELIVERY_PRICE = 0;

  function setMsg(t) { if (msg) msg.textContent = t || ""; }
  function formatKZT(value) {
    const s = String(Math.round(Number(value) || 0));
    return `${s.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
  }
  function loadCart() {
    if (Cart?.getCart) return Cart.getCart();
    try { return JSON.parse(localStorage.getItem("market_cart") || "{}"); } catch { return {}; }
  }
  function clearCart() {
    if (Cart?.clearCart) return Cart.clearCart();
    localStorage.setItem("market_cart", "{}");
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

  async function renderSummary() {
    const cart = loadCart();
    const entries = Object.entries(cart).filter(([_, q]) => Number(q) > 0);
    if (!entries.length) {
      itemsEl.innerHTML = '<div class="muted">Корзина пуста. Вернись и добавь товары.</div>';
      itemsMetaEl.textContent = '0 товаров';
      subtotalEl.textContent = formatKZT(0);
      deliveryEl.textContent = formatKZT(0);
      totalEl.textContent = formatKZT(0);
      return false;
    }

    const map = await getProductsMap();
    let totalQty = 0;
    let subtotal = 0;
    const rows = [];

    for (const [pid, qtyRaw] of entries) {
      const qty = Math.max(1, Number(qtyRaw) || 1);
      const product = map.get(Number(pid));
      if (!product) continue;
      totalQty += qty;
      subtotal += (Number(product.price) || 0) * qty;
      rows.push(`
        <div class="chItem">
          <div class="chItem__main">
            <div class="chItem__title">${product.title}</div>
            <div class="chItem__meta">${product.category || "Товар"} • ${qty} шт.</div>
          </div>
          <div class="chItem__sum">${formatKZT((Number(product.price) || 0) * qty)}</div>
        </div>
      `);
    }

    itemsEl.innerHTML = rows.join("");
    itemsMetaEl.textContent = `${rows.length} поз. • ${totalQty} шт.`;
    subtotalEl.textContent = formatKZT(subtotal);
    deliveryEl.textContent = formatKZT(DELIVERY_PRICE);
    totalEl.textContent = formatKZT(subtotal + DELIVERY_PRICE);
    return rows.length > 0;
  }

  btn?.addEventListener("click", async () => {
    setMsg("");

    if (!MarketAPI.getToken()) {
      location.href = "login.html";
      return;
    }

    const cart = loadCart();
    const entries = Object.entries(cart).filter(([_, q]) => Number(q) > 0);
    if (!entries.length) {
      setMsg("Корзина пустая.");
      return;
    }

    const items = entries
      .map(([pid, qty]) => ({ product_id: Number(pid), qty: Number(qty) }))
      .filter((x) => Number.isFinite(x.product_id) && x.qty > 0);

    const delivery = {
      method: "standard",
      city: String(cityEl?.value || "").trim(),
      address: String(addrEl?.value || "").trim(),
      phone: String(phoneEl?.value || "").trim(),
      price: DELIVERY_PRICE,
    };

    if (!delivery.city || !delivery.address || !delivery.phone) {
      setMsg("Заполни город, адрес и телефон.");
      return;
    }

    const res = await MarketAPI.apiFetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({ items, delivery, comment: String(commentEl?.value || "").trim() }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (data && data.error === "not_enough_stock") {
        const pid = String(data.product_id || "");
        const title = data.title || ("Товар #" + pid);
        const reqQty = Number(data.requested_qty || 0);
        const avail = Number(data.available_stock);

        try {
          const cart2 = loadCart();
          if (Number.isFinite(avail)) {
            if (avail <= 0) delete cart2[pid];
            else cart2[pid] = avail;
            if (Cart?.setCart) Cart.setCart(cart2);
            else localStorage.setItem("market_cart", JSON.stringify(cart2));
          }
        } catch {}

        if (Number.isFinite(avail)) {
          setMsg(avail <= 0
            ? `Товар закончился: ${title}. Мы убрали его из корзины.`
            : `Недостаточно товара: ${title}. Хотели ${reqQty || "—"}, доступно ${avail}. Корзина обновлена.`);
        } else {
          setMsg(`Недостаточно товара: ${title}. Корзина обновлена.`);
        }

        renderSummary();
        return;
      }

      window.UI?.toast?.("Ошибка оформления заказа", "error");
      setMsg(data?.error || "Не удалось создать заказ.");
      return;
    }

    clearCart();
    window.UI?.toast?.("Заказ успешно создан", "success");
    location.href = `payment.html?id=${data.id}`;
  });

  renderSummary();
})();
