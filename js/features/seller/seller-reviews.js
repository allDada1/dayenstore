(function(){
  const H = window.SellerStoreHelpers || {};
  const els = {
    title: document.getElementById("reviewsTitle"),
    meta: document.getElementById("reviewsMeta"),
    list: document.getElementById("reviewsList"),
    empty: document.getElementById("reviewsEmpty"),
    back: document.getElementById("backToStore"),
    pagination: document.getElementById("reviewsPagination")
  };

  const PAGE_SIZE = 8;
  let allItems = [];
  let page = 1;

  function getSellerId(){
    const raw = String(new URLSearchParams(location.search).get("id") || "").trim();
    const id = Number(raw || 0);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  function formatDate(value){
    if (!value) return "";
    try { return new Date(value).toLocaleString("ru-RU", { hour12:false }); }
    catch { return String(value); }
  }

  function renderUnavailable(payload = {}){
    document.title = "Store — Отзывы магазина недоступны";
    if (els.title) els.title.textContent = "Отзывы магазина недоступны";
    if (els.meta) {
      const adminComment = String(payload.admin_comment || "").trim();
      els.meta.textContent = adminComment
        ? `Магазин временно недоступен. Комментарий администратора: ${adminComment}`
        : "Магазин временно недоступен.";
    }
    if (els.list) els.list.innerHTML = "";
    if (els.pagination) els.pagination.innerHTML = "";
    if (els.empty) {
      els.empty.hidden = false;
      const t = els.empty.querySelector('.empty__title');
      const d = els.empty.querySelector('.empty__text');
      if (t) t.textContent = "Отзывы сейчас недоступны";
      if (d) d.textContent = String(payload.admin_comment || "").trim() || "Страница магазина сейчас неактивна.";
    }
  }

  function renderItem(item){
    const img = String(item.product_image_url || "").trim();
    const rating = Math.max(1, Math.min(5, Number(item.rating) || 0));
    const stars = rating ? `★ ${rating}/5` : "Без оценки";
    const comment = String(item.comment || "").trim() || "Покупатель оставил оценку без комментария.";
    return `
      <article class="sellerReviewCard">
        <div class="sellerReviewCard__top">
          <div class="sellerReviewCard__product">
            <div class="sellerReviewCard__thumb">${img ? `<img src="${H.escapeHtml(img)}" alt="">` : ""}</div>
            <div>
              <div class="sellerReviewCard__title">${H.escapeHtml(item.product_title || "Товар")}</div>
              <div class="sellerReviewCard__sub">Покупатель: ${H.escapeHtml(item.user_name || "Покупатель")}</div>
            </div>
          </div>
          <div class="sellerReviewCard__rating">${stars}</div>
        </div>
        <div class="sellerReviewCard__comment">${H.escapeHtml(comment)}</div>
        <div class="sellerReviewCard__date">${H.escapeHtml(formatDate(item.created_at))}</div>
      </article>
    `;
  }

  function renderPagination(totalItems){
    if (!els.pagination) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    page = Math.min(Math.max(1, page), totalPages);

    if (totalItems <= PAGE_SIZE) {
      els.pagination.innerHTML = "";
      return;
    }

    const start = totalItems ? ((page - 1) * PAGE_SIZE) + 1 : 0;
    const end = Math.min(totalItems, page * PAGE_SIZE);

    els.pagination.innerHTML = `
      <div class="sellerPagination__info">Показано ${start}-${end} из ${totalItems}</div>
      <div class="sellerPagination__actions">
        <button class="btn btn--ghost" type="button" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>← Назад</button>
        <div class="sellerPagination__page">Страница ${page} / ${totalPages}</div>
        <button class="btn btn--ghost" type="button" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>Вперёд →</button>
      </div>
    `;
  }

  function renderList(){
    const total = allItems.length;
    const start = (page - 1) * PAGE_SIZE;
    const visible = allItems.slice(start, start + PAGE_SIZE);

    if (els.meta) {
      els.meta.textContent = total <= PAGE_SIZE
        ? `Всего отзывов: ${total}`
        : `Всего отзывов: ${total} · Страница ${page}`;
    }

    if (els.list) els.list.innerHTML = visible.map(renderItem).join("");
    if (els.empty) els.empty.hidden = total > 0;
    renderPagination(total);
  }

  async function load(){
    const sellerId = getSellerId();
    if (!sellerId) {
      if (els.title) els.title.textContent = "Магазин не найден";
      if (els.meta) els.meta.textContent = "Не удалось определить продавца.";
      if (els.empty) els.empty.hidden = false;
      return;
    }

    if (els.back) els.back.href = `seller.html?id=${sellerId}`;

    const profileRes = await fetch(`/api/sellers/${sellerId}`);
    const profileData = await profileRes.json().catch(() => ({}));
    if (!profileRes.ok) {
      if (profileData?.error === "seller_inactive") {
        renderUnavailable(profileData);
        return;
      }
      if (els.title) els.title.textContent = "Магазин не найден";
      if (els.meta) els.meta.textContent = "Продавец не существует или удалён.";
      if (els.empty) els.empty.hidden = false;
      return;
    }

    const displayName = profileData?.seller?.nickname || profileData?.seller?.name || "Магазин";
    document.title = `Store — Отзывы: ${displayName}`;
    if (els.title) els.title.textContent = `Отзывы магазина ${displayName}`;

    const reviewsRes = await fetch(`/api/sellers/${sellerId}/reviews`);
    const reviewsData = await reviewsRes.json().catch(() => ({}));
    if (!reviewsRes.ok) {
      if (reviewsData?.error === "seller_inactive") {
        renderUnavailable(reviewsData);
        return;
      }
      throw new Error(reviewsData?.error || `http_${reviewsRes.status}`);
    }

    allItems = Array.isArray(reviewsData?.items) ? reviewsData.items : [];
    page = 1;
    renderList();
  }

  document.addEventListener('click', (e) => {
    const pageBtn = e.target?.dataset?.page;
    if (!pageBtn) return;
    page = Math.max(1, Number(pageBtn) || 1);
    renderList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  load().catch((err) => {
    console.error(err);
    if (els.title) els.title.textContent = "Ошибка";
    if (els.meta) els.meta.textContent = "Не удалось загрузить отзывы магазина.";
    if (els.pagination) els.pagination.innerHTML = "";
    if (els.empty) els.empty.hidden = false;
  });
})();
