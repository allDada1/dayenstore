// js/components/product-card.js

(function () {
  const Utils = window.MarketUtils || {};

  function formatKZT(v) {
    return Utils.formatKZT ? Utils.formatKZT(v) : `${Math.round(Number(v) || 0)} ₸`;
  }

  function escapeHtml(v) {
    return Utils.escapeHtml ? Utils.escapeHtml(v) : String(v ?? "");
  }

  function starsSmall(avg) {
    const a = Number(avg) || 0;
    return a ? `⭐ ${a.toFixed(1)}` : "Без оценок";
  }

  function imageHtml(p) {
    const img = String((Array.isArray(p.images) && p.images[0]) || p.image_url || "").trim();

    if (!img) {
      return `<div class="ph">Фото</div>`;
    }

    return `
      <img
        src="${escapeHtml(img)}"
        alt="${escapeHtml(p.title || "")}"
        loading="lazy"
        decoding="async"
        fetchpriority="low"
        draggable="false"
      >
    `;
  }

  function cardTemplate(p) {
    const category = escapeHtml(p.category || "Товар");
    const title = escapeHtml(p.title || "Без названия");
    const stock = Math.max(0, Number(p.stock) || 0);
    const stockText = stock > 0 ? `В наличии: ${stock}` : "Нет в наличии";

    return `
<article class="card" data-id="${p.id}">
  <div class="card__img">
    ${imageHtml(p)}
    <div class="card__tag">${category}</div>
  </div>

  <div class="card__body">
    <h3 class="card__title">${title}</h3>

    <div class="card__metaRow">
      <div class="ratingBadge">${starsSmall(p.rating_avg)}</div>
    </div>

    <div class="card__row">
      <div class="card__priceBlock">
        <div class="price">${formatKZT(p.price)}</div>
      </div>

      <button class="btn btn--primary" data-add type="button"${stock <= 0 ? " disabled" : ""}>
        В корзину
      </button>
    </div>
  </div>
</article>
`;
  }

  function bindClicks(container, addToCart) {
    if (!container) return;
    if (container.dataset.cardClicksBound === "1") return;

    container.dataset.cardClicksBound = "1";

    container.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      const card = e.target.closest(".card");

      if (!card || !container.contains(card)) return;

      if (addBtn) {
        e.stopPropagation();
        const id = card.dataset.id;
        if (!id || addBtn.disabled) return;
        addToCart?.(id);
        return;
      }

      location.href = `product.html?id=${card.dataset.id}`;
    });
  }

  window.ProductCard = {
    template: cardTemplate,
    bindClicks
  };
})();