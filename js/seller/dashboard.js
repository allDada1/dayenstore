(function(){
  const msg = (t) => {
    const el = document.getElementById('sellerMsg');
    if (el) el.textContent = t || '';
  };

  const becomeBox = document.getElementById('becomeBox');
  const profileBox = document.getElementById('profileBox');
  const requestStateText = document.getElementById('requestStateText');
  const stateBadge = document.getElementById('sellerStateBadge');
  const subbarMount = document.getElementById('subbarMount');
  const salesInfo = document.getElementById('sellerSalesInfo');

  function setSalesInfo(text){
    if (salesInfo) salesInfo.textContent = text || '';
  }

  async function loadSalesSummary(){
    try {
      const data = await fetchJson('/api/seller/sales');
      const summary = data?.summary || {};
      const total = Number(summary.total_count || 0);
      const fresh = Number(summary.new_count || 0);
      setSalesInfo(`Новых продаж: ${fresh} • Всего продаж: ${total}`);
    } catch {
      setSalesInfo('');
    }
  }

  function setStateBadge(text, variant = 'idle'){
    if (!stateBadge) return;
    stateBadge.textContent = text || '';
    stateBadge.className = 'sellerDashState';
    if (variant) stateBadge.classList.add(`is-${variant}`);
  }

  function setRequestState(text, variant = ''){
    if (!requestStateText) return;
    requestStateText.textContent = text || '';
    requestStateText.className = 'muted';
    if (text) requestStateText.classList.add('sellerRequestState');
    if (variant) requestStateText.classList.add(`is-${variant}`);
  }

  function isInlineImageUrl(value){
    return String(value || '').trim().startsWith('data:image/');
  }

  function setImageFieldValue(input, value, label){
    if (!input) return;
    const raw = String(value || '').trim();
    input.dataset.rawValue = raw;
    input.value = isInlineImageUrl(raw) ? `${label} загружено` : raw;
  }

  function getImageFieldValue(input){
    if (!input) return '';
    const raw = String(input.dataset.rawValue || '').trim();
    if (raw && isInlineImageUrl(raw)) return raw;
    return String(input.value || '').trim();
  }


  function humanizeApplyError(code){
    const map = {
      missing_fields: 'Заполни slug магазина и название магазина.',
      bad_shop_slug: 'Slug магазина должен быть на английском: латиница, цифры и дефис.',
      bad_shop_name: 'Название магазина заполнено некорректно.',
      bad_avatar_url: 'Ссылка на фото магазина заполнена некорректно.',
      bad_contacts: 'Поле контактов заполнено некорректно.',
      bad_about: 'Описание магазина заполнено некорректно.',
      request_already_pending: 'Заявка уже отправлена и находится на рассмотрении.',
      shop_slug_taken: 'Такой slug уже занят. Выбери другой.',
      already_seller: 'У этого аккаунта уже есть доступ продавца.'
    };
    return map[String(code || '').trim()] || '';
  }

  function buildInactiveMessage(payload, fallbackText){
    const comment = String(payload?.admin_comment || '').trim();
    const baseText = String(payload?.message || fallbackText || 'Доступ продавца сейчас отключён.').trim();
    return comment ? `${baseText} Комментарий администратора: ${comment}` : baseText;
  }

  function hideSellerNav(){
    if (subbarMount) subbarMount.style.display = 'none';
  }

  function token(){
    try{
      if (window.Auth && typeof Auth.getToken==='function') return Auth.getToken()||'';
      if (window.MarketAPI && typeof MarketAPI.getToken==='function') return MarketAPI.getToken()||'';
    }catch{}
    return localStorage.getItem('market_token') || localStorage.getItem('token') || '';
  }

  async function apiFetchCompat(url, opt = {}){
    try{
      if (window.MarketAPI && typeof MarketAPI.apiFetch === 'function') return await window.MarketAPI.apiFetch(url, opt);
    }catch{}
    const headers = { ...(opt.headers || {}) };
    const t = token();
    if (t && !headers.Authorization) headers.Authorization = 'Bearer ' + t;
    return fetch(url, { ...opt, headers });
  }

  async function fetchJson(url, opt = {}){
    const r = await apiFetchCompat(url, opt);
    let data = null;
    try{ data = await r.json(); }catch{ data = null; }
    if (!r.ok){
      const err = data?.error || `http_${r.status}`;
      throw new Error(err);
    }
    return data;
  }

  async function uploadImage(file){
    const t = token();
    if (!t) throw new Error('no_token');

    const fd = new FormData();
    fd.append('image', file);

    const res = await fetch('/api/uploads/image?token=' + encodeURIComponent(t), {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + t,
        'X-Market-Token': t
      },
      body: fd
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'upload_failed');
    return data.url || '';
  }

  function setPreview(imgId, emptyId, url){
    const img = document.getElementById(imgId);
    const empty = document.getElementById(emptyId);
    const u = String(url || '').trim();

    if (img){
      img.src = u || '';
      img.hidden = !u;
    }
    if (empty) empty.hidden = !!u;
  }

  function bindUpload(buttonId, inputId, clearId, hiddenInputId, previewImgId, previewEmptyId, label){
    const btn = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    const clearBtn = document.getElementById(clearId);
    const hidden = document.getElementById(hiddenInputId);

    btn?.addEventListener('click', () => input?.click());

    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      msg(`Загрузка: ${label}...`);
      try{
        const url = await uploadImage(file);
        if (hidden) hidden.value = url;
        setPreview(previewImgId, previewEmptyId, url);
        msg(`${label} загружен ✅`);
      }catch(err){
        msg('Ошибка загрузки: ' + (err.message || 'unknown'));
      }finally{
        input.value = '';
      }
    });

    clearBtn?.addEventListener('click', () => {
      if (hidden) hidden.value = '';
      setPreview(previewImgId, previewEmptyId, '');
    });
  }

  function showSellerProfileFromData(seller, text){
    if (becomeBox) becomeBox.style.display = 'none';
    if (profileBox) profileBox.style.display = '';
    setStateBadge('Магазин активен', 'active');

    const shopNameEl = document.getElementById('shopName');
    const shopAvatarEl = document.getElementById('shopAvatar');
    const shopBannerEl = document.getElementById('shopBanner');
    const shopAboutEl = document.getElementById('shopAbout');
    const goShop = document.getElementById('goShop');
    const shopTelegramEl = document.getElementById('shopTelegram');
    const shopInstagramEl = document.getElementById('shopInstagram');
    const shopWhatsappEl = document.getElementById('shopWhatsapp');
    const shopTiktokEl = document.getElementById('shopTiktok');

    if (shopNameEl) shopNameEl.value = seller?.name || seller?.shop_name || '';
    if (shopAvatarEl) shopAvatarEl.value = seller?.avatar_url || '';
    if (shopBannerEl) shopBannerEl.value = seller?.banner_url || '';
    if (shopAboutEl) shopAboutEl.value = seller?.about || '';
    if (shopTelegramEl) shopTelegramEl.value = seller?.telegram || '';
    if (shopInstagramEl) shopInstagramEl.value = seller?.instagram || '';
    if (shopWhatsappEl) shopWhatsappEl.value = seller?.whatsapp || '';
    if (shopTiktokEl) shopTiktokEl.value = seller?.tiktok || '';

    setPreview('shopAvatarPreview', 'shopAvatarEmpty', seller?.avatar_url || '');
    setPreview('shopBannerPreview', 'shopBannerEmpty', seller?.banner_url || '');

    if (goShop) {
      const sellerId = seller?.id || '';
      goShop.href = sellerId ? `seller.html?id=${sellerId}` : '#';
    }

    msg(text || 'Витрина продавца активна');
    loadSalesSummary().catch(() => {});
  }

  function showBecomeBox(text, variant = 'idle'){
    if (profileBox) profileBox.style.display = 'none';
    if (becomeBox) becomeBox.style.display = '';
    hideSellerNav();
    if (variant === 'pending') setStateBadge('Заявка на рассмотрении', 'pending');
    else if (variant === 'rejected') setStateBadge('Заявка отклонена', 'rejected');
    else if (variant === 'inactive') setStateBadge('Доступ продавца отключён', 'inactive');
    else setStateBadge('Пока нет магазина', 'idle');
    msg(text || 'Заполни форму и отправь заявку администратору.');
  }

  function showRequestState(request){
    if (!requestStateText) return;
    if (!request){ setRequestState(''); return; }

    if (request.status === 'pending'){
      setRequestState('Заявка на рассмотрении. Повторно отправлять не нужно.', 'pending');
      return;
    }

    if (request.status === 'rejected'){
      const text = 'Заявка отклонена' + (request.admin_comment ? (': ' + request.admin_comment) : '. Можно отправить новую.');
      setRequestState(text, 'rejected');
      return;
    }

    if (request.status === 'inactive'){
      setRequestState(buildInactiveMessage(request, 'Доступ продавца сейчас отключён.'), 'inactive');
      return;
    }

    if (request.status === 'approved'){
      setRequestState('Заявка одобрена.', 'approved');
      return;
    }

    setRequestState('');
  }

  async function init(){
    if (!token()){
      location.href = 'login.html';
      return;
    }

    setStateBadge('Проверка статуса…', 'idle');
    setRequestState('');

    let meData = null;
    try { meData = await fetchJson('/api/auth/me'); } catch {}
    const meUser = meData?.user || null;
    const userIsSeller = !!meUser?.is_seller;

    let accessBlockedPayload = null;

    try {
      const meResponse = await apiFetchCompat('/api/seller/me');
      const mePayload = await meResponse.json().catch(() => ({}));
      if (meResponse.ok) {
        const seller = mePayload?.seller || null;
        if (seller) {
          showSellerProfileFromData(seller, 'Витрина продавца активна');
          return;
        }
      } else if (mePayload?.error === 'seller_only') {
        accessBlockedPayload = mePayload;
      }
    } catch {}

    try {
      const data = await fetchJson('/api/seller/request-status');
      const request = data?.request || null;
      const requestStatus = String(request?.status || '').toLowerCase();

      const hasRequest = !!request;
      const isRevokedState = hasRequest && requestStatus === 'approved' && !userIsSeller;

      if (accessBlockedPayload && isRevokedState) {
        showBecomeBox(buildInactiveMessage(accessBlockedPayload, 'Доступ продавца сейчас отключён.'), 'inactive');
        showRequestState({
          status: 'inactive',
          admin_comment: accessBlockedPayload.admin_comment || request?.admin_comment || '',
          message: accessBlockedPayload.message || ''
        });
      } else if (userIsSeller) {
        showSellerProfileFromData({
          id: meUser?.id || '',
          name: request?.shop_name || meUser?.name || '',
          avatar_url: request?.avatar_url || meUser?.avatar_url || '',
          banner_url: meUser?.seller_banner_url || '',
          about: request?.about || '',
          telegram: meUser?.seller_telegram || '',
          instagram: meUser?.seller_instagram || '',
          whatsapp: meUser?.seller_whatsapp || '',
          tiktok: meUser?.seller_tiktok || ''
        }, 'Витрина продавца активна');
        return;
      } else {
        const becomeText = requestStatus === 'pending'
          ? 'Заявка уже отправлена и находится на рассмотрении.'
          : requestStatus === 'rejected'
            ? 'Исправь данные и отправь заявку повторно.'
            : 'Заполни форму и отправь заявку администратору.';
        const becomeVariant = requestStatus === 'pending' ? 'pending' : requestStatus === 'rejected' ? 'rejected' : 'idle';
        showBecomeBox(becomeText, becomeVariant);
        showRequestState(request);
      }

      const applyBtn = document.getElementById('applyBtn');
      if (applyBtn) applyBtn.disabled = requestStatus === 'pending';

      if (requestStatus === 'rejected') {
        const usernameEl = document.getElementById('username');
        const avatarUrlEl = document.getElementById('avatarUrl');
        const shopNameEl = document.getElementById('requestShopName');
        const contactsEl = document.getElementById('requestContacts');
        const aboutEl = document.getElementById('requestAbout');

        if (usernameEl) usernameEl.value = request.shop_slug || '';
        setImageFieldValue(avatarUrlEl, request.avatar_url || '', 'Фото магазина');
        if (shopNameEl) shopNameEl.value = request.shop_name || '';
        if (contactsEl) contactsEl.value = request.contacts || '';
        if (aboutEl) aboutEl.value = request.about || '';
      }
    } catch (err) {
      if (userIsSeller && !accessBlockedPayload) {
        showSellerProfileFromData({
          id: meUser?.id || '',
          name: meUser?.name || '',
          avatar_url: meUser?.avatar_url || '',
          banner_url: meUser?.seller_banner_url || '',
          about: '',
          telegram: meUser?.seller_telegram || '',
          instagram: meUser?.seller_instagram || '',
          whatsapp: meUser?.seller_whatsapp || '',
          tiktok: meUser?.seller_tiktok || ''
        }, 'Витрина продавца активна');
        return;
      }

      if (accessBlockedPayload) {
        showBecomeBox(buildInactiveMessage(accessBlockedPayload, 'Доступ продавца сейчас отключён.'), 'inactive');
        showRequestState({
          status: 'inactive',
          admin_comment: accessBlockedPayload.admin_comment || '',
          message: accessBlockedPayload.message || ''
        });
        return;
      }

      showBecomeBox('Заполни форму и отправь заявку администратору.', 'idle');
    }
  }

  async function applySeller(){
    const shop_slug = document.getElementById('username')?.value.trim() || '';
    const avatar_url = getImageFieldValue(document.getElementById('avatarUrl'));
    const shop_name = document.getElementById('requestShopName')?.value.trim() || '';
    const contacts = document.getElementById('requestContacts')?.value.trim() || '';
    const about = document.getElementById('requestAbout')?.value.trim() || '';

    try {
      const data = await fetchJson('/api/seller/apply', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ shop_slug, avatar_url, shop_name, contacts, about })
      });

      await init();
      msg(data.message || 'Заявка отправлена и ожидает проверки администратора.');
      setStateBadge('Заявка на рассмотрении', 'pending');
      setRequestState('Заявка на рассмотрении. Повторно отправлять не нужно.', 'pending');
      const applyBtn = document.getElementById('applyBtn');
      if (applyBtn) applyBtn.disabled = true;
    } catch (err) {
      throw new Error(humanizeApplyError(err.message) || err.message || 'unknown');
    }
  }

  async function saveProfile(){
    const shop_name = document.getElementById('shopName')?.value || '';
    const avatar_url = document.getElementById('shopAvatar')?.value || '';
    const banner_url = document.getElementById('shopBanner')?.value || '';
    const about = document.getElementById('shopAbout')?.value || '';
    const telegram = document.getElementById('shopTelegram')?.value || '';
    const instagram = document.getElementById('shopInstagram')?.value || '';
    const whatsapp = document.getElementById('shopWhatsapp')?.value || '';
    const tiktok = document.getElementById('shopTiktok')?.value || '';

    await fetchJson('/api/seller/profile', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        shop_name,
        avatar_url,
        banner_url,
        about,
        telegram,
        instagram,
        whatsapp,
        tiktok
      })
    });

    msg('Сохранено ✅');
  }

  bindUpload('pickShopAvatarBtn', 'shopAvatarInput', 'clearShopAvatarBtn', 'shopAvatar', 'shopAvatarPreview', 'shopAvatarEmpty', 'Фото магазина');
  bindUpload('pickShopBannerBtn', 'shopBannerInput', 'clearShopBannerBtn', 'shopBanner', 'shopBannerPreview', 'shopBannerEmpty', 'Баннер');

  document.getElementById('avatarUrl')?.addEventListener('input', (e) => {
    const input = e.currentTarget;
    if (!input) return;
    input.dataset.rawValue = String(input.value || '').trim();
  });

  document.addEventListener('click', (e)=>{
    if (e.target && e.target.id==='applyBtn') applySeller().catch(err=>msg(err.message || 'Не удалось отправить заявку.'));
    if (e.target && e.target.id==='saveProfileBtn') saveProfile().catch(err=>msg('Ошибка: '+err.message));
  });

  init().catch(err=>msg('Ошибка: '+(err.message||'unknown')));
})();
