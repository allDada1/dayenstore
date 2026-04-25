function getTokenCompat(){
  try{
    if (window.MarketAPI && typeof window.MarketAPI.getToken === "function"){
      return window.MarketAPI.getToken() || "";
    }
  }catch{}
  return (
    localStorage.getItem("market_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

async function apiFetchCompat(url, options = {}){
  try{
    if (window.MarketAPI && typeof window.MarketAPI.apiFetch === "function"){
      return await window.MarketAPI.apiFetch(url, options);
    }
  }catch{}

  const headers = { ...(options.headers || {}) };
  const token = getTokenCompat();
  if (token && !headers.Authorization){
    headers.Authorization = "Bearer " + token;
  }
  return fetch(url, { ...options, headers });
}

const E = (id) => document.getElementById(id);

const ui = {
  guard: E("admGuardText"),
  id: E("ordId"),
  load: E("ordLoadBtn"),
  refresh: E("ordRefreshBtn"),
  note: E("ordNote"),
  card: E("ordCard"),
  status: E("ordStatus"),
  noteInput: E("ordNoteInput"),
  apply: E("ordApplyBtn"),
};

let currentOrderId = 0;

function setNote(text){
  if (!ui.note) return;
  ui.note.textContent = text || "";
}

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function fmtMoney(value){
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return `${esc(value)} ₸`;
  return `${String(Math.round(num)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
}

function fmtDate(value){
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("ru-RU");
}

function getStatusClass(status){
  const value = String(status || "").trim().toLowerCase();
  if (["pending","paid","shipped","delivered","cancelled"].includes(value)) return value;
  return "pending";
}

async function ensureAdmin(){
  const r = await apiFetchCompat("/api/auth/me");
  if (r.status === 401){
    location.href = "login.html";
    return false;
  }
  const d = await r.json().catch(()=>({}));
  if (!d.user?.is_admin){
    if (ui.guard) ui.guard.textContent = "Доступ запрещён: только администратор.";
    return false;
  }
  if (ui.guard) ui.guard.textContent = "Доступ: администратор ✅";
  return true;
}

function normalizeId(){
  return Math.max(0, Number(ui.id?.value || 0) || 0);
}

async function loadOrder(orderId){
  setNote("Загрузка заказа...");
  currentOrderId = orderId;
  if (ui.card){
    ui.card.style.display = "none";
    ui.card.innerHTML = "";
  }

  const r = await apiFetchCompat(`/api/orders/${orderId}`);
  if (!r.ok){
    const e = await r.json().catch(()=>({}));
    setNote(`Ошибка: ${e.error || r.status}`);
    return;
  }

  const data = await r.json().catch(()=>({}));
  const order = data.order || {};
  const items = Array.isArray(data.items) ? data.items : [];

  const rh = await apiFetchCompat(`/api/orders/${orderId}/history`);
  const rawHistory = rh.ok ? await rh.json().catch(()=>[]) : [];
  const history = Array.isArray(rawHistory)
  ? rawHistory
  : Array.isArray(rawHistory?.history)
    ? rawHistory.history
    : Array.isArray(rawHistory?.items)
      ? rawHistory.items
      : [];

  if (ui.status){
    ui.status.value = String(order.status || "pending");
    window.NiceSelect?.refresh?.(ui.status);
  }

  const itemsHtml = items.map((it) => `
    <div class="orderLine">
      <div>
        <div class="orderLine__title"><b>#${esc(it.product_id)}</b> ${esc(it.title)} × ${esc(it.qty)}</div>
        <div class="orderLine__meta">Цена за единицу: ${fmtMoney(it.price)}</div>
      </div>
      <div class="orderLine__price">${fmtMoney((Number(it.price) || 0) * (Number(it.qty) || 0))}</div>
    </div>
  `).join("");

  const histHtml = history.map((h) => `
    <div class="orderHistoryItem">
      <div class="orderHistoryItem__left">
        <span class="orderStatusPill is-${getStatusClass(h.status)}">${esc(h.status)}</span>
        ${h.note ? `<div class="orderHistory__note">${esc(h.note)}</div>` : ""}
      </div>
      <div class="muted">${esc(fmtDate(h.created_at))}</div>
    </div>
  `).join("") || `<div class="emptyStateMini">История пока пуста</div>`;

  ui.card.innerHTML = `
    <div class="orderSummaryGrid">
      <div class="orderSummaryBox">
        <span>Заказ</span>
        <b>#${esc(order.id)}</b>
      </div>
      <div class="orderSummaryBox">
        <span>Статус</span>
        <div class="orderStatusPill is-${getStatusClass(order.status)}">${esc(order.status)}</div>
      </div>
      <div class="orderSummaryBox">
        <span>Покупатель</span>
        <b>user_id: ${esc(order.user_id)}</b>
      </div>
      <div class="orderSummaryBox">
        <span>Итого</span>
        <b>${fmtMoney(order.total)}</b>
      </div>
      <div class="orderSummaryBox">
        <span>Создан</span>
        <b>${esc(fmtDate(order.created_at))}</b>
      </div>
      <div class="orderSummaryBox">
        <span>Обновлён</span>
        <b>${esc(fmtDate(order.updated_at))}</b>
      </div>
      <div class="orderSummaryBox">
        <span>Товаров в заказе</span>
        <b>${items.length}</b>
      </div>
      <div class="orderSummaryBox">
        <span>Записей в истории</span>
        <b>${history.length}</b>
      </div>
    </div>

    <div class="admOrdersBlocks">
      <section class="admOrdersBlock">
        <h3 class="admTitle2">Состав заказа</h3>
        <div class="list">${itemsHtml || '<div class="emptyStateMini">Пусто</div>'}</div>
      </section>
      <section class="admOrdersBlock">
        <h3 class="admTitle2">История статусов</h3>
        <div class="list">${histHtml}</div>
      </section>
    </div>
  `;

  ui.card.style.display = "grid";
  setNote("Заказ загружен ✅");
}

async function applyStatus(){
  const orderId = normalizeId();
  if (!orderId) return setNote("Введите ID заказа");
  const status = String(ui.status?.value || "").trim();
  const note = String(ui.noteInput?.value || "").trim();
  setNote("Применяю статус...");

  const r = await apiFetchCompat(`/api/orders/${orderId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note })
  });

  if (!r.ok){
    const e = await r.json().catch(()=>({}));
    return setNote(`Ошибка: ${e.error || r.status}`);
  }

  await loadOrder(orderId);
}

(async function init(){
  window.NiceSelect?.initAll?.();
  window.NiceSelect?.refresh?.(ui.status);

  const ok = await ensureAdmin();
  if (!ok) return;

  const openCurrentOrder = () => {
    const id = normalizeId();
    if (!id) return setNote("Введите ID заказа");
    loadOrder(id).catch((e) => setNote("Ошибка: " + String(e?.message || e)));
  };

  ui.load?.addEventListener("click", openCurrentOrder);
  ui.refresh?.addEventListener("click", () => {
    const id = normalizeId() || currentOrderId;
    if (!id) return setNote("Введите ID заказа");
    if (ui.id && !ui.id.value) ui.id.value = String(id);
    loadOrder(id).catch((e) => setNote("Ошибка: " + String(e?.message || e)));
  });
  ui.apply?.addEventListener("click", () => {
    applyStatus().catch((e) => setNote("Ошибка: " + String(e?.message || e)));
  });

  ui.id?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      openCurrentOrder();
    }
  });

  ui.noteInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ui.apply?.click();
    }
  });
})();
