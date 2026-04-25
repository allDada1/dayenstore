// js/features/product-related.js

(function () {
  function createProductRelatedFeature() {
    let deps = null;

    function el() {
      return deps?.els || {};
    }

    function escapeHtml(v) {
      return deps?.escapeHtml ? deps.escapeHtml(v) : String(v ?? "");
    }

    function formatKZT(v) {
      return deps?.formatKZT ? deps.formatKZT(v) : `${Math.round(Number(v) || 0)} ₸`;
    }

    function buildImages(p) {
      return deps?.buildImages ? deps.buildImages(p) : [];
    }

    function cardHtml(p) {
      const src = buildImages(p)[0] || p.image_url || "";
      return `
        <article class="simCard" data-id="${p.id}">
          <div class="simCard__media">${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(p.title)}">` : `<div class="ph">Нет фото</div>`}</div>
          <div class="simCard__body">
            <div class="simTop">
              <div class="simTitle">${escapeHtml(p.title)}</div>
              <div class="simPrice">${escapeHtml(formatKZT(p.price))}</div>
            </div>
            <div class="simMeta">${escapeHtml(p.category || "Без категории")} • ⭐ ${Number(p.rating_avg || 0).toFixed(1)}</div>
          </div>
        </article>
      `;
    }

    function bindCardClicks(root) {
      if (!root) return;
      root.querySelectorAll(".simCard").forEach((card) => {
        card.addEventListener("click", () => {
          location.href = `product.html?id=${Number(card.dataset.id)}`;
        });
      });
    }

    function renderBlock(sectionEl, listEl, rows) {
      if (!sectionEl || !listEl) return;

      if (!rows.length) {
        sectionEl.hidden = true;
        listEl.innerHTML = "";
        return;
      }

      sectionEl.hidden = false;
      listEl.innerHTML = rows.map(cardHtml).join("");
      bindCardClicks(listEl);
    }

    function renderSimilar(rows) {
      const elements = el();
      renderBlock(elements.similarSection, elements.similarList, rows || []);
    }

    function renderBoughtTogether(rows) {
      const elements = el();
      renderBlock(elements.boughtTogetherSection, elements.boughtTogetherList, rows || []);
    }

    function renderRecentlyViewed(rows) {
      const elements = el();
      renderBlock(elements.recentSection, elements.recentList, rows || []);
    }

    function init(options) {
      deps = options || {};
    }

    return {
      init,
      renderSimilar,
      renderBoughtTogether,
      renderRecentlyViewed
    };
  }

  window.ProductRelatedFeature = createProductRelatedFeature();
})();