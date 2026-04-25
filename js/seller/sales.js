(function(){
  const E = (id) => document.getElementById(id);
  const ui = {
    total: E('salesTotal'),
    fresh: E('salesNew'),
    note: E('salesNote'),
    search: E('salesSearch'),
    status: E('salesStatusFilter'),
    sort: E('salesSort'),
    reset: E('salesResetBtn'),
    meta: E('salesMeta'),
    list: E('salesList'),
    pagination: E('salesPagination'),
  };

  const PAGE_SIZE = 8;
  let all = [];
  let page = 1;

  function token(){
    try {
      if (window.Auth && typeof window.Auth.getToken === 'function') return window.Auth.getToken() || '';
      if (window.MarketAPI && typeof window.MarketAPI.getToken === 'function') return window.MarketAPI.getToken() || '';
    } catch {}
    return localStorage.getItem('market_token') || localStorage.getItem('token') || '';
  }

  async function apiFetchCompat(url, options = {}){
    try {
      if (window.MarketAPI && typeof window.MarketAPI.apiFetch === 'function') return await window.MarketAPI.apiFetch(url, options);
    } catch {}
    const headers = { ...(options.headers || {}) };
    const t = token();
    if (t && !headers.Authorization) headers.Authorization = 'Bearer ' + t;
    return fetch(url, { ...options, headers });
  }

  async function fetchJson(url, options = {}){
    const response = await apiFetchCompat(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `http_${response.status}`);
    return data;
  }

  function setNote(text){ if (ui.note) ui.note.textContent = text || ''; }

  function refreshSelects(){
    window.NiceSelect?.refresh?.(ui.status);
    window.NiceSelect?.refresh?.(ui.sort);
    document.querySelectorAll('[data-sales-status]').forEach((select) => {
      window.NiceSelect?.refresh?.(select);
    });
  }

  function esc(s){ return String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
  function formatKZT(v){ const s = String(Math.round(Number(v) || 0)); return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₸'; }
  function formatDate(v){ if (!v) return '—'; try { return new Date(v).toLocaleString('ru-RU', { hour12:false }); } catch { return String(v); } }

  function statusLabel(status){
    const map = {
      pending: ['Ожидает оплаты', 'is-pending'],
      paid: ['Оплачен', 'is-paid'],
      shipped: ['Отправлен', 'is-shipped'],
      delayed: ['Задерживается', 'is-delayed'],
      delivered: ['Доставлен', 'is-delivered'],
      cancelled: ['Отменён', 'is-cancelled'],
      created: ['Создан', 'is-pending'],
    };
    return map[String(status || '').toLowerCase()] || [status || '—', ''];
  }

  function statusBadge(status){
    const [label, cls] = statusLabel(status);
    return `<span class="sellerStatusBadge ${cls}">${esc(label)}</span>`;
  }

  function renderStatusOptions(current){
    const labels = {
      pending:'Ожидает оплаты',
      paid:'Оплачен',
      shipped:'Отправлен',
      delayed:'Задерживается',
      delivered:'Доставлен',
      cancelled:'Отменён'
    };
    return ['<option value="">Выбери статус</option>']
      .concat(Object.keys(labels).map((key) => `<option value="${key}" ${String(current||'')===key?'selected':''}>${labels[key]}</option>`))
      .join('');
  }

  function rowTemplate(row){
    return `
      <article class="sellerSaleRow" data-sale-id="${Number(row.sale_id) || 0}">
        <div class="sellerSaleRow__main">
          <div class="sellerSaleRow__thumb">${row.image_url ? `<img src="${esc(row.image_url)}" alt="">` : '<span class="muted">Фото</span>'}</div>
          <div class="sellerSaleRow__info">
            <div class="sellerSaleRow__title">Заказ #${Number(row.order_id) || 0} · ${esc(row.product_title || 'Товар')}</div>
            <div class="sellerSaleRow__sub">Покупатель: <b>${esc(row.buyer_name || 'Покупатель')}</b> · ${esc(row.buyer_email || '—')}</div>
            <div class="sellerSaleRow__sub">Дата: ${esc(formatDate(row.created_at))}</div>
            ${row.order_comment ? `<div class="sellerSaleRow__comment">Комментарий покупателя: ${esc(row.order_comment)}</div>` : ''}
            ${row.seller_note ? `<div class="sellerSaleRow__comment">Последний комментарий продавца: ${esc(row.seller_note)}</div>` : ''}
          </div>
        </div>
        <div class="sellerSaleRow__side">
          <div class="sellerSaleStat"><span>Количество</span><b>${Number(row.qty || 0)} шт.</b></div>
          <div class="sellerSaleStat"><span>Сумма</span><b>${formatKZT(row.line_total)}</b></div>
          <div class="sellerSaleStat"><span>Цена за шт.</span><b>${formatKZT(row.price)}</b></div>
          <div class="sellerSaleStat"><span>Статус</span><b>${statusBadge(row.status)}</b></div>
        </div>
        <div class="sellerSaleRow__actions">
          <select class="input js-nice-select" data-nice-select data-sales-status>
            ${renderStatusOptions(row.status)}
          </select>
          <input class="input" data-sales-note placeholder="Комментарий к смене статуса (необязательно)" value="${esc(row.seller_note || '')}" />
          <button class="btn btn--primary" type="button" data-sales-apply>Сохранить статус</button>
          <a class="btn btn--ghost" href="product.html?id=${Number(row.product_id) || 0}">Открыть товар</a>
        </div>
      </article>`;
  }

  function applyFilters(){
    const q = String(ui.search?.value || '').trim().toLowerCase();
    const status = String(ui.status?.value || 'all');
    const sort = String(ui.sort?.value || 'new');
    const rows = all.filter((row) => {
      if (status !== 'all' && String(row.status || '').toLowerCase() !== status) return false;
      if (!q) return true;
      const hay = [row.order_id, row.product_title, row.buyer_name, row.buyer_email, row.order_comment, row.seller_note].join(' ').toLowerCase();
      return hay.includes(q);
    });
    rows.sort((a,b) => {
      if (sort === 'old') return Number(a.order_id || 0) - Number(b.order_id || 0);
      if (sort === 'sum_desc') return Number(b.line_total || 0) - Number(a.line_total || 0);
      if (sort === 'buyer') return String(a.buyer_name || '').localeCompare(String(b.buyer_name || ''), 'ru');
      return Number(b.order_id || 0) - Number(a.order_id || 0);
    });
    return rows;
  }

  function renderPagination(totalItems){
    if (!ui.pagination) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    page = Math.min(Math.max(1, page), totalPages);
    if (totalPages <= 1) { ui.pagination.innerHTML = ''; return; }
    const start = totalItems ? ((page - 1) * PAGE_SIZE) + 1 : 0;
    const end = Math.min(totalItems, page * PAGE_SIZE);
    ui.pagination.innerHTML = `
      <div class="adminPagination__info">Показано ${start}-${end} из ${totalItems}</div>
      <div class="adminPagination__actions">
        <button class="btn btn--ghost" type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Назад</button>
        <div class="adminPagination__page">Страница ${page} / ${totalPages}</div>
        <button class="btn btn--ghost" type="button" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Вперёд →</button>
      </div>`;
  }

  function render(){
    const rows = applyFilters();
    const total = rows.length;
    const start = (page - 1) * PAGE_SIZE;
    const visible = rows.slice(start, start + PAGE_SIZE);
    if (ui.list) ui.list.innerHTML = visible.length ? visible.map(rowTemplate).join('') : '<div class="emptyStateMini">Продаж пока нет</div>';
    if (ui.meta) {
      const shownFrom = total ? start + 1 : 0;
      const shownTo = Math.min(total, start + PAGE_SIZE);
      ui.meta.textContent = `Показано ${shownFrom}-${shownTo} из ${total}`;
    }
    renderPagination(total);
    refreshSelects();
  }

  async function load(){
    setNote('Загрузка продаж…');
    const data = await fetchJson('/api/seller/sales');
    all = Array.isArray(data.items) ? data.items : [];
    const summary = data.summary || {};
    if (ui.total) ui.total.textContent = String(Number(summary.total_count || 0));
    if (ui.fresh) ui.fresh.textContent = String(Number(summary.new_count || 0));
    page = 1;
    render();
    setNote(all.length ? 'Продажи загружены ✅' : 'Продаж пока нет');
  }

  async function updateStatus(saleId, status, note){
    await fetchJson(`/api/seller/sales/${saleId}/status`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ status, note })
    });
    await load();
    setNote(`Статус продажи #${saleId} обновлён ✅`);
  }

  document.addEventListener('click', async (e) => {
    const pageBtn = e.target?.dataset?.page;
    if (pageBtn) {
      page = Math.max(1, Number(pageBtn) || 1);
      render();
      return;
    }

    const applyBtn = e.target?.closest?.('[data-sales-apply]');
    if (applyBtn) {
      const row = applyBtn.closest('.sellerSaleRow');
      const saleId = Number(row?.dataset?.saleId || 0);
      const status = row?.querySelector('[data-sales-status]')?.value || '';
      const note = row?.querySelector('[data-sales-note]')?.value || '';
      if (!saleId || !status) {
        setNote('Выбери новый статус продажи');
        return;
      }
      try {
        await updateStatus(saleId, status, note);
      } catch (err) {
        setNote('Ошибка: ' + (err.message || 'unknown'));
      }
    }
  });

  ui.search?.addEventListener('input', () => { page = 1; render(); });
  ui.status?.addEventListener('change', () => { page = 1; render(); });
  ui.sort?.addEventListener('change', () => { page = 1; render(); });
  ui.reset?.addEventListener('click', () => {
    if (ui.search) ui.search.value = '';
    if (ui.status) ui.status.value = 'all';
    if (ui.sort) ui.sort.value = 'new';
    refreshSelects();
    page = 1;
    render();
    setNote('Фильтры сброшены');
  });

  (async function init(){
    if (!token()) { location.href = 'login.html'; return; }
    window.NiceSelect?.initAll?.();
    refreshSelects();
    try {
      await load();
    } catch (err) {
      setNote('Ошибка: ' + (err.message || 'unknown'));
    }
  })();
})();
