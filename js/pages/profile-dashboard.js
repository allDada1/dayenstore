(function(){
  const ordersEl = document.getElementById('statOrders');
  const paidEl = document.getElementById('statPaid');
  const favEl = document.getElementById('statFavorites');
  const productsEl = document.getElementById('statProducts');

  const pendingEl = document.getElementById('statPending');
  const paidFullEl = document.getElementById('statPaidFull');
  const deliveredEl = document.getElementById('statDelivered');

  const summaryEl = document.getElementById('profileSummaryText');
  const lastOrderStateEl = document.getElementById('lastOrderState');
  const favoritesStateEl = document.getElementById('favoritesState');
  const sellerStateEl = document.getElementById('sellerStateBox');
  const actionBoardEl = document.getElementById('profileActionBoard');
  const heroQuickStatusEl = document.getElementById('heroQuickStatus');
  const heroQuickAccessEl = document.getElementById('heroQuickAccess');
  const heroQuickNextEl = document.getElementById('heroQuickNext');


  if (!ordersEl && !paidEl && !favEl && !productsEl && !summaryEl) return;

  function setText(el, value){ if (el) el.textContent = String(value); }
  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value){
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' });
  }

  function statusText(status){
    const s = String(status || '').toLowerCase();
    if (s === 'pending') return 'Ожидает оплаты';
    if (s === 'paid') return 'Оплачен';
    if (s === 'shipped') return 'Отправлен';
    if (s === 'delivered') return 'Доставлен';
    if (s === 'cancelled') return 'Отменён';
    return 'Без статуса';
  }

  async function loadMe(){
    try{
      const res = await MarketAPI.apiFetch('/api/auth/me');
      if (!res.ok) return null;
      const data = await res.json().catch(()=>null);
      return data?.user || null;
    } catch { return null; }
  }

  async function loadSellerRequest(){
    try{
      const res = await MarketAPI.apiFetch('/api/seller/request-status');
      if (!res.ok) return null;
      const data = await res.json().catch(()=>null);
      return data?.request || null;
    } catch { return null; }
  }

  async function loadOrders(){
    try{
      const res = await MarketAPI.apiFetch('/api/orders/my');
      if (!res.ok) return [];
      const data = await res.json().catch(()=>[]);
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }

  async function loadFavorites(){
    try{
      const res = await MarketAPI.apiFetch('/api/favorites');
      if (!res.ok) return [];
      const data = await res.json().catch(()=>({}));
      return Array.isArray(data?.items) ? data.items : [];
    } catch { return []; }
  }

  async function loadProducts(){
    try{
      const res = await MarketAPI.apiFetch('/api/profile/products');
      if (!res.ok) return [];
      const data = await res.json().catch(()=>({ products: [] }));
      return Array.isArray(data.products) ? data.products : [];
    } catch { return []; }
  }


  function setStateVariant(el, variant){
    if (!el) return;
    el.classList.remove('stateBox--neutral','stateBox--info','stateBox--success','stateBox--warning','stateBox--danger');
    el.classList.add(variant || 'stateBox--neutral');
  }

  function setStatVariant(el, variant){
    if (!el) return;
    el.classList.remove('statCard--accent','statCard--success','statCard--info','statCard--warning');
    el.classList.add(variant || 'statCard--accent');
  }

  function renderSummary(user, request, orders, favorites, products){
    const delivered = orders.filter(o => String(o.status || '').toLowerCase() === 'delivered').length;
    const pending = orders.filter(o => String(o.status || '').toLowerCase() === 'pending').length;

    let text = 'Аккаунт выглядит спокойно и готов к работе.';

    if (!orders.length && !favorites.length){
      text = 'Профиль уже готов. Осталось выбрать первые товары, добавить интересные позиции в избранное и оформить первый заказ.';
    } else if (pending > 0){
      text = `Сейчас у тебя ${pending} ${pending === 1 ? 'заказ ожидает' : pending < 5 ? 'заказа ожидают' : 'заказов ожидают'} оплаты или подтверждения. Есть смысл проверить историю заказов.`;
    } else if (delivered > 0){
      text = `У тебя уже ${delivered} ${delivered === 1 ? 'доставленный заказ' : delivered < 5 ? 'доставленных заказа' : 'доставленных заказов'}. Можно вернуться к понравившимся товарам или продолжить покупки.`;
    } else if (favorites.length > 0){
      text = `В избранном уже ${favorites.length} ${favorites.length === 1 ? 'товар' : favorites.length < 5 ? 'товара' : 'товаров'}. Можно быстро вернуться к ним и оформить покупку.`;
    }

    if (user?.is_admin) {
      text += ' У тебя также открыт доступ к административным инструментам.';
    } else if (user?.is_seller) {
      text += ` Магазин продавца активен${products.length ? `, сейчас опубликовано ${products.length} товаров` : ''}.`;
    } else if (String(request?.status || '').toLowerCase() === 'pending') {
      text += ' Заявка продавца уже отправлена и ждёт проверки.';
    }

    if (summaryEl) summaryEl.textContent = text;
  }

  function renderLastOrder(orders){
    if (!lastOrderStateEl) return;
    if (!orders.length){
      setStateVariant(lastOrderStateEl, 'stateBox--neutral');
      const orderStatus = String(order?.status || '').toLowerCase();
    setStateVariant(lastOrderStateEl, orderStatus === 'delivered' ? 'stateBox--success' : orderStatus === 'paid' || orderStatus === 'shipped' ? 'stateBox--info' : orderStatus === 'pending' ? 'stateBox--warning' : orderStatus === 'cancelled' ? 'stateBox--danger' : 'stateBox--neutral');

    lastOrderStateEl.innerHTML = `
        <div class="stateBox__title">Пока нет заказов</div>
        <div class="stateBox__sub">Когда появятся покупки, здесь будет их последний статус.</div>
      `;
      return;
    }

    const order = orders[0];
    const orderId = order?.id ? `Заказ #${esc(order.id)}` : 'Последний заказ';
    const when = formatDate(order?.created_at || order?.date || order?.updated_at);
    const sum = order?.total_price ?? order?.total ?? order?.sum;
    const meta = [];
    if (when) meta.push(`от ${when}`);
    if (sum != null && !Number.isNaN(Number(sum))) meta.push(`${Number(sum).toLocaleString('ru-RU')} ₸`);

    const orderStatus = String(order?.status || '').toLowerCase();
    setStateVariant(lastOrderStateEl, orderStatus === 'delivered' ? 'stateBox--success' : orderStatus === 'paid' || orderStatus === 'shipped' ? 'stateBox--info' : orderStatus === 'pending' ? 'stateBox--warning' : orderStatus === 'cancelled' ? 'stateBox--danger' : 'stateBox--neutral');

    lastOrderStateEl.innerHTML = `
      <div class="stateBox__title">${orderId}</div>
      <div class="stateBox__sub">Текущий статус: ${esc(statusText(order?.status))}.</div>
      <div class="stateBox__meta">${esc(meta.join(' • ') || 'Статус обновится после изменения заказа')}</div>
    `;
  }

  function renderFavorites(favorites){
    if (!favoritesStateEl) return;
    if (!favorites.length){
      setStateVariant(favoritesStateEl, 'stateBox--neutral');
      favoritesStateEl.innerHTML = `
        <div class="stateBox__title">Избранное ещё пустое</div>
        <div class="stateBox__sub">Сохраняй товары, чтобы быстро вернуться к ним позже.</div>
      `;
      return;
    }

    setStateVariant(favoritesStateEl, 'stateBox--info');
    const first = favorites[0] || {};
    const title = String(first.title || 'Есть сохранённые товары');
    favoritesStateEl.innerHTML = `
      <div class="stateBox__title">${esc(title)}</div>
      <div class="stateBox__sub">В избранном сейчас ${favorites.length} ${favorites.length === 1 ? 'товар' : favorites.length < 5 ? 'товара' : 'товаров'}. Можно открыть список и быстро вернуться к интересным позициям.</div>
      <div class="stateBox__meta">Готово к быстрому возврату</div>
    `;
  }

  function renderSellerState(user, request, products){
    if (!sellerStateEl) return;

    if (user?.is_admin){
      setStateVariant(sellerStateEl, 'stateBox--danger');
      setStateVariant(sellerStateEl, 'stateBox--info');
    sellerStateEl.innerHTML = `
        <div class="stateBox__title">Администратор системы</div>
        <div class="stateBox__sub">У аккаунта есть расширенный доступ к управлению товарами, заказами и категориями.</div>
        <div class="stateBox__meta">Полный доступ</div>
      `;
      return;
    }

    if (user?.is_seller){
      setStateVariant(sellerStateEl, 'stateBox--success');
      setStateVariant(sellerStateEl, 'stateBox--info');
    sellerStateEl.innerHTML = `
        <div class="stateBox__title">Магазин продавца активен</div>
        <div class="stateBox__sub">Можно управлять магазином, редактировать карточки и следить за товарами.${products.length ? ` Сейчас опубликовано ${products.length} товаров.` : ''}</div>
        <div class="stateBox__meta">Статус продавца активен</div>
      `;
      return;
    }

    const status = String(request?.status || '').toLowerCase();
    if (status === 'pending'){
      setStateVariant(sellerStateEl, 'stateBox--warning');
      setStateVariant(sellerStateEl, 'stateBox--info');
    sellerStateEl.innerHTML = `
        <div class="stateBox__title">Заявка на продавца уже отправлена</div>
        <div class="stateBox__sub">Администратор ещё проверяет данные. После одобрения здесь появится быстрый переход в панель продавца.</div>
        <div class="stateBox__meta">Ожидает проверки</div>
      `;
      return;
    }

    if (status === 'rejected'){
      setStateVariant(sellerStateEl, 'stateBox--danger');
      const reason = String(request?.admin_comment || '').trim();
      setStateVariant(sellerStateEl, 'stateBox--info');
    sellerStateEl.innerHTML = `
        <div class="stateBox__title">Заявка отклонена</div>
        <div class="stateBox__sub">${esc(reason ? `Причина: ${reason}. Можно исправить данные и подать заявку повторно.` : 'Можно открыть раздел продавца, посмотреть статус и отправить заявку ещё раз.')}</div>
        <div class="stateBox__meta">Можно отправить повторно</div>
      `;
      return;
    }

    setStateVariant(sellerStateEl, 'stateBox--info');
    sellerStateEl.innerHTML = `
      <div class="stateBox__title">Обычный аккаунт покупателя</div>
      <div class="stateBox__sub">Можно продолжать покупки или подать заявку и открыть свой магазин прямо из личного кабинета.</div>
      <div class="stateBox__meta">Готов к расширению</div>
    `;
  }

  function renderActionBoard(user, request, orders, favorites, products){
    if (!actionBoardEl) return;

    const items = [];
    items.push({ href:'index.html', title:'Продолжить покупки', sub:'Вернись в каталог и посмотри новые товары.', tag:'Каталог' });

    if (orders.length){
      items.push({ href:'orders.html', title:'Проверить статусы заказов', sub:'Открой историю покупок и посмотри все изменения по заказам.', tag:'Заказы' });
    } else {
      items.push({ href:'index.html', title:'Оформить первый заказ', sub:'Добавь товар в корзину и протестируй полный путь покупки.', tag:'Старт' });
    }

    if (favorites.length){
      items.push({ href:'favorites.html', title:'Вернуться к избранному', sub:'У тебя уже есть сохранённые позиции, можно быстро открыть их снова.', tag:'Избранное' });
    } else {
      items.push({ href:'favorites.html', title:'Начать собирать избранное', sub:'Сохраняй интересные товары, чтобы не потерять их позже.', tag:'Подсказка' });
    }

    if (user?.is_admin){
      setStateVariant(sellerStateEl, 'stateBox--danger');
      items.push({ href:'admin-tiles.html', title:'Открыть админ-панель', sub:'Перейди к управлению категориями и товарами.', tag:'Админ' });
    } else if (user?.is_seller){
      items.push({ href:'seller-products.html', title:'Управлять товарами магазина', sub: products.length ? 'Добавь новые товары или обнови уже опубликованные позиции.' : 'В магазине пока нет товаров — можно добавить первые позиции.', tag:'Магазин' });
    } else if (String(request?.status || '').toLowerCase() === 'pending'){
      items.push({ href:'seller-dashboard.html', title:'Проверить заявку продавца', sub:'Статус уже отправлен на модерацию. Здесь можно посмотреть текущее состояние заявки.', tag:'Заявка' });
    } else {
      items.push({ href:'seller-dashboard.html', title:'Открыть свой магазин', sub:'Подай заявку продавца и получи доступ к панели магазина.', tag:'Продавец' });
    }

    actionBoardEl.innerHTML = items.slice(0, 4).map(item => `
      <a class="actionHint" href="${esc(item.href)}">
        <div class="actionHint__eyebrow">${esc(item.tag || 'Действие')}</div>
        <div class="actionHint__title">${esc(item.title)}</div>
        <div class="actionHint__sub">${esc(item.sub)}</div>
      </a>
    `).join('');
  }


  function renderHeroQuick(user, request, orders, favorites, products){
    if (heroQuickStatusEl){
      if (!orders.length) heroQuickStatusEl.textContent = 'Пока без заказов';
      else heroQuickStatusEl.textContent = statusText(orders[0]?.status);
    }

    if (heroQuickAccessEl){
      if (user?.is_admin) heroQuickAccessEl.textContent = 'Админ-панель и управление';
      else if (user?.is_seller) heroQuickAccessEl.textContent = 'Покупки и магазин продавца';
      else if (String(request?.status || '').toLowerCase() === 'pending') heroQuickAccessEl.textContent = 'Покупки и заявка продавца';
      else heroQuickAccessEl.textContent = 'Покупки и избранное';
    }

    if (heroQuickNextEl){
      if (!orders.length) heroQuickNextEl.textContent = 'Выбрать первый товар';
      else if (favorites.length) heroQuickNextEl.textContent = 'Вернуться к избранному';
      else if (user?.is_seller) heroQuickNextEl.textContent = products.length ? 'Обновить карточки магазина' : 'Добавить первые товары';
      else if (String(request?.status || '').toLowerCase() === 'pending') heroQuickNextEl.textContent = 'Проверить заявку продавца';
      else heroQuickNextEl.textContent = 'Открыть каталог';
    }
  }

  async function render(){
    setText(ordersEl, '…');
    setText(paidEl, '…');
    setText(favEl, '…');
    setText(productsEl, '…');
    setText(pendingEl, '…');
    setText(paidFullEl, '…');
    setText(deliveredEl, '…');

    const [user, request, orders, favorites, products] = await Promise.all([
      loadMe(),
      loadSellerRequest(),
      loadOrders(),
      loadFavorites(),
      loadProducts()
    ]);

    const pendingCount = orders.filter(o => String(o.status || '').toLowerCase() === 'pending').length;
    const paidCount = orders.filter(o => String(o.status || '').toLowerCase() === 'paid').length;
    const deliveredCount = orders.filter(o => String(o.status || '').toLowerCase() === 'delivered').length;

    setText(ordersEl, orders.length || 0);
    setText(paidEl, paidCount || 0);
    setText(favEl, favorites.length || 0);
    setText(productsEl, products.length || 0);
    const productsCard = productsEl?.closest('.statCard');
    if (productsCard) productsCard.style.display = user?.is_seller ? '' : 'none';

    setStatVariant(ordersEl?.closest('.statCard'), orders.length ? 'statCard--accent' : 'statCard--warning');
    setStatVariant(paidEl?.closest('.statCard'), paidCount ? 'statCard--success' : 'statCard--accent');
    setStatVariant(favEl?.closest('.statCard'), favorites.length ? 'statCard--info' : 'statCard--accent');
    setStatVariant(productsEl?.closest('.statCard'), products.length ? 'statCard--success' : 'statCard--accent');
    setText(pendingEl, pendingCount || 0);
    setText(paidFullEl, paidCount || 0);
    setText(deliveredEl, deliveredCount || 0);

    renderHeroQuick(user, request, orders, favorites, products);
    renderSummary(user, request, orders, favorites, products);
    renderLastOrder(orders);
    renderFavorites(favorites);
    renderSellerState(user, request, products);
    renderActionBoard(user, request, orders, favorites, products);
  }

  render();
})();
