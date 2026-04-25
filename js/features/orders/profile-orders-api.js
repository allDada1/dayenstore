(function () {
  function formatKZT(value) {
    const s = String(Math.round(Number(value) || 0));
    return `${s.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
  }
  function formatDate(iso) {
    try { return new Date(iso).toLocaleString("ru-RU"); } catch { return String(iso || "—"); }
  }
  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const ordersList = document.getElementById("ordersList");
  const ordersEmpty = document.getElementById("ordersEmpty");
  const refreshBtn = document.getElementById("refreshOrdersBtn");
  const pager = document.getElementById("ordersPager");
  const pagerInfo = document.getElementById("ordersPagerInfo");
  const prevBtn = document.getElementById("ordersPrevBtn");
  const nextBtn = document.getElementById("ordersNextBtn");
  const metaEl = document.getElementById("ordersMeta");

  if (!ordersList) return;

  const PAGE_SIZE = 5;
  let allOrders = [];
  let currentPage = 1;

  async function loadMyOrders() {
    const res = await MarketAPI.apiFetch("/api/orders/my");
    if (res.status === 401) return { error: "unauthorized", orders: [] };
    if (!res.ok) return { error: "server_error", orders: [] };
    const data = await res.json().catch(() => []);
    return { error: null, orders: Array.isArray(data) ? data : [] };
  }

  async function loadOrderDetails(id) {
    const res = await MarketAPI.apiFetch(`/api/orders/${id}`);
    if (res.status === 401) return { error: "unauthorized" };
    if (!res.ok) return { error: "server_error" };
    const data = await res.json().catch(() => null);
    return data ? { error: null, data } : { error: "bad_json" };
  }

  async function loadOrderHistory(id) {
    const res = await MarketAPI.apiFetch(`/api/orders/${id}/history`);
    if (res.status === 401) return { error: "unauthorized", history: [] };
    if (!res.ok) return { error: "server_error", history: [] };
    const data = await res.json().catch(() => []);
    const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return { error: null, history: list };
  }

  function statusLabel(status) {
    const map = {
      pending: ["Ожидает оплаты", "pill--pending"],
      paid: ["Оплачен", "pill--paid"],
      shipped: ["Отправлен", "pill--shipped"],
      delayed: ["Задерживается", "pill--pending"],
      delivered: ["Доставлен", "pill--delivered"],
      cancelled: ["Отменён", "pill--cancelled"],
      mixed: ["Статусы у продавцов разные", "pill--pending"],
      created: ["Создан", "pill--pending"],
    };
    return map[String(status || "").toLowerCase()] || [String(status || "—"), "pill--pending"];
  }

  function itemStatusBadge(status) {
    const [label, cls] = statusLabel(status);
    return `<span class="pill ${cls}">${esc(label)}</span>`;
  }

  function timelineTemplate(history) {
    if (!history || !history.length) {
      return `<div class="muted" style="margin-top:8px;">История статусов пока пуста.</div>`;
    }
    return `
      <div class="timeline">
        <div class="detailBox__t">История статусов</div>
        <div class="timeline__list">
          ${history.map((h) => `
            <div class="timeline__item">
              <div class="timeline__dot"></div>
              <div class="timeline__body">
                <div class="timeline__top">
                  <b>${esc(h.status)}</b>
                  <span class="timeline__time">${formatDate(h.created_at)}</span>
                </div>
                ${h.note ? `<div class="timeline__note">${esc(h.note)}</div>` : ``}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  async function repeatOrder(orderId) {
    const res = await MarketAPI.apiFetch(`/api/orders/${orderId}/repeat`, { method: "POST" });
    if (res.status === 401) {
      MarketAPI.setToken("");
      localStorage.removeItem("market_session");
      location.href = "login.html";
      return;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      alert("Не удалось повторить заказ.");
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    const cart = window.MarketUtils
      ? MarketUtils.loadCart()
      : (() => { try { return JSON.parse(localStorage.getItem("market_cart") || "{}"); } catch { return {}; } })();

    let removed = 0;
    let reduced = 0;

    for (const it of items) {
      const pid = String(it.product_id);
      const want = Math.max(1, Number(it.qty) || 1);
      const avail = Number(it.available_stock);
      if (Number.isFinite(avail)) {
        if (avail <= 0) { removed++; continue; }
        const q = Math.min(want, avail);
        if (q < want) reduced++;
        cart[pid] = q;
      } else {
        cart[pid] = want;
      }
    }

    if (window.MarketUtils) {
      MarketUtils.saveCart(cart);
      MarketUtils.updateCartBadge("cartBadge", { hideWhenZero: false });
    } else {
      localStorage.setItem("market_cart", JSON.stringify(cart));
    }

    if (removed || reduced) {
      alert(`Корзина обновлена. Убрано товаров: ${removed}, уменьшено по наличию: ${reduced}.`);
    }

    location.href = "cart.html";
  }

  function orderCard(o) {
    const statusRaw = o.display_status || o.status || "created";
    const [statusText, pillClass] = statusLabel(statusRaw);

    return `
      <article class="order" id="order-${o.id}" data-id="${o.id}">
        <div class="order__top" data-toggle>
          <div>
            <div class="order__id">#${o.id}</div>
            <div class="order__meta">${formatDate(o.created_at)} • статус заказа: ${esc(statusText)}</div>
          </div>
          <div class="order__right">
            <div class="order__sum">${formatKZT(o.total)}</div>
            <div class="pill ${pillClass}">${esc(statusText)}</div>
          </div>
        </div>
        <div class="order__details"></div>
      </article>
    `;
  }


  function aggregateOrderDisplayStatus(order, items) {
    const statuses = (Array.isArray(items) ? items : [])
      .map((it) => String(it?.seller_status || '').toLowerCase().trim())
      .filter(Boolean);

    if (!statuses.length) return String(order?.display_status || order?.status || 'created').toLowerCase();

    const uniq = [...new Set(statuses)];
    if (uniq.length === 1) return uniq[0];
    return 'mixed';
  }

  function updateOrderHeaderState(root, order, items) {
    if (!root) return;
    const status = aggregateOrderDisplayStatus(order, items);
    const [statusText, pillClass] = statusLabel(status);
    const meta = root.querySelector('.order__meta');
    const pill = root.querySelector('.order__right .pill');
    if (meta) {
      meta.textContent = `${formatDate(order?.created_at)} • статус заказа: ${statusText}`;
    }
    if (pill) {
      pill.className = `pill ${pillClass}`;
      pill.textContent = statusText;
    }
  }

  function detailsTemplate(order, items, history) {
    const st = String(order?.status || "created").toLowerCase();
    const canPay = !["paid", "cancelled", "delivered"].includes(st);
    const itemsHtml = (items || []).map((it) => `
      <div class="itemRow" style="display:grid; gap:6px; align-items:start;">
        <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <span>${esc(it.title)} <b>×${it.qty}</b></span>
          <span>${formatKZT(it.price * it.qty)}</span>
        </div>
        <div class="muted" style="font-size:13px;">Продавец: <b>${esc(it.seller_name || 'Продавец')}</b>${it.seller_email ? ` · ${esc(it.seller_email)}` : ''}</div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          ${itemStatusBadge(it.seller_status)}
          ${it.seller_note ? `<span class="muted" style="font-size:13px;">Комментарий продавца: ${esc(it.seller_note)}</span>` : ''}
        </div>
      </div>
    `).join("");

    return `
      <div class="detailGrid">
        <div class="detailBox">
          <div class="detailBox__t">Доставка</div>
          <div class="detailBox__v">
            Город: <b>${esc(order.delivery_city || "—")}</b><br>
            Адрес: <b>${esc(order.delivery_address || "—")}</b><br>
            Телефон: <b>${esc(order.phone || "—")}</b>
          </div>
        </div>
        <div class="detailBox">
          <div class="detailBox__t">Суммы</div>
          <div class="detailBox__v">
            Товары: <b>${formatKZT(order.subtotal)}</b><br>
            Доставка: <b>${formatKZT(order.delivery_price)}</b><br>
            Итого: <b>${formatKZT(order.total)}</b>
          </div>
        </div>
      </div>
      <div class="items">
        <div class="itemsHead">
          <div class="detailBox__t">Состав заказа и статусы продавцов</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            ${canPay ? `<button class="btn btn--primary" type="button" data-pay>Оплатить</button>` : ``}
            <button class="btn btn--ghost btnRepeat" type="button" data-repeat>Повторить</button>
          </div>
        </div>
        ${itemsHtml || `<div style="color:rgba(255,255,255,.7)">Пусто</div>`}
      </div>
      ${timelineTemplate(history)}
    `;
  }

  function pageSlice() {
    const totalPages = Math.max(1, Math.ceil(allOrders.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    return {
      totalPages,
      list: allOrders.slice(start, start + PAGE_SIZE),
    };
  }

  async function bindOpeners() {
    ordersList.querySelectorAll("[data-toggle]").forEach((top) => {
      top.addEventListener("click", async () => {
        const root = top.closest(".order");
        const details = root.querySelector(".order__details");

        root.classList.toggle("is-open");
        if (!root.classList.contains("is-open")) return;
        if (details.dataset.loaded === "1") return;

        details.innerHTML = `<div class="muted" style="padding:10px 0;">Загрузка…</div>`;
        const id = root.dataset.id;

        const [d, h] = await Promise.all([loadOrderDetails(id), loadOrderHistory(id)]);
        if (d.error === "unauthorized") {
          MarketAPI.setToken("");
          localStorage.removeItem("market_session");
          location.href = "login.html";
          return;
        }
        if (d.error) {
          details.innerHTML = `<div class="muted" style="padding:10px 0;">Ошибка деталей</div>`;
          return;
        }

        details.innerHTML = detailsTemplate(d.data.order, d.data.items, h.error ? [] : h.history);
        updateOrderHeaderState(root, d.data.order, d.data.items);
        details.dataset.loaded = "1";

        details.querySelector("[data-repeat]")?.addEventListener("click", (e) => {
          e.stopPropagation();
          repeatOrder(id);
        });
        details.querySelector("[data-pay]")?.addEventListener("click", (e) => {
          e.stopPropagation();
          location.href = `payment.html?id=${id}`;
        });
      });
    });
  }

  async function renderPage() {
    if (!allOrders.length) {
      ordersList.innerHTML = "";
      ordersEmpty.hidden = false;
      pager.hidden = true;
      if (metaEl) metaEl.textContent = "Пока пусто";
      return;
    }

    ordersEmpty.hidden = true;
    const { totalPages, list } = pageSlice();
    ordersList.innerHTML = list.map(orderCard).join("");
    await bindOpeners();

    pager.hidden = totalPages <= 1;
    if (pagerInfo) pagerInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (metaEl) metaEl.textContent = `Всего заказов: ${allOrders.length}`;

    const hash = (location.hash || "").trim();
    if (hash && document.querySelector(hash)) {
      document.querySelector(hash)?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }

  async function render() {
    const { error, orders } = await loadMyOrders();
    if (error === "unauthorized") {
      MarketAPI.setToken("");
      localStorage.removeItem("market_session");
      location.href = "login.html";
      return;
    }
    allOrders = orders;
    currentPage = 1;
    renderPage();
  }

  prevBtn?.addEventListener("click", () => {
    currentPage = Math.max(1, currentPage - 1);
    renderPage();
  });
  nextBtn?.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(allOrders.length / PAGE_SIZE));
    currentPage = Math.min(totalPages, currentPage + 1);
    renderPage();
  });
  refreshBtn?.addEventListener("click", render);
  render();
})();
