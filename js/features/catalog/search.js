// js/features/search.js

(function () {
  function createSearchFeature() {
    let deps = null;
    let allProductsCache = null;

    function getCatalogApi() {
      return deps?.catalogApi || null;
    }

    function getAppApi() {
      return deps?.appApi || null;
    }

    function getModalEls() {
      return {
        modal: document.getElementById("searchModal"),
        overlay: document.querySelector(".searchModal__overlay"),
        input: document.getElementById("searchModalInput"),
        btn: document.getElementById("searchModalBtn"),
        close: document.getElementById("searchModalClose"),
        results: document.getElementById("searchModalResults")
      };
    }

    function escapeHtml(str) {
      if (window.MarketUtils?.escapeHtml) return window.MarketUtils.escapeHtml(str);
      return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function formatKZT(value) {
      if (window.MarketUtils?.formatKZT) return window.MarketUtils.formatKZT(value);

      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return "";
      return `${n.toLocaleString("ru-RU")} ₸`;
    }

    function setResults(html) {
      const { results } = getModalEls();
      if (results) results.innerHTML = html;
    }

    function renderEmptyStart() {
      setResults(`
        <div class="searchModal__state">
          <div class="searchModal__stateTitle">Начните поиск</div>
          <div class="searchModal__stateText">Введите название товара, категорию или ключевое слово.</div>
        </div>
      `);
    }

    function renderLoading() {
      setResults(`
        <div class="searchModal__state">
          <div class="searchModal__stateTitle">Поиск...</div>
        </div>
      `);
    }

    function renderNothingFound(q) {
      setResults(`
        <div class="searchModal__state">
          <div class="searchModal__stateTitle">Ничего не найдено</div>
          <div class="searchModal__stateText">По запросу “${escapeHtml(q)}” совпадений пока нет.</div>
        </div>
      `);
    }

    function normalizeImageUrl(raw) {
      const url = String(raw || "").trim();
      if (!url) return "";

      if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("/uploads/") ||
        url.startsWith("uploads/") ||
        url.startsWith("/images/") ||
        url.startsWith("images/") ||
        url.startsWith("data:image/")
      ) {
        return url.startsWith("uploads/") || url.startsWith("images/")
          ? `/${url}`
          : url;
      }

      return url;
    }

    function getProductThumb(product) {
      const direct = normalizeImageUrl(product?.image_url);
      if (direct) return direct;

      if (Array.isArray(product?.images) && product.images.length) {
        const fromImages = normalizeImageUrl(product.images[0]);
        if (fromImages) return fromImages;
      }

      return "";
    }

    function buildProductMeta(product) {
      const parts = [];

      const category = String(product?.category || "").trim();
      const section = String(product?.section || "").trim();

      if (category) parts.push(category);
      if (section && section !== category) parts.push(section);

      return parts;
    }

    async function fetchAllProducts() {
      if (Array.isArray(allProductsCache)) return allProductsCache;
      try {
        const res = await fetch("/api/products");
        if (!res.ok) return [];
        const data = await res.json().catch(() => ({}));
        allProductsCache = Array.isArray(data?.items) ? data.items : [];
        return allProductsCache;
      } catch {
        return [];
      }
    }

    function makeProductLookup(products) {
      const byId = new Map();
      const byTitle = new Map();

      (Array.isArray(products) ? products : []).forEach((p) => {
        const id = Number(p?.id);
        const titleKey = String(p?.title || "").trim().toLowerCase();

        if (Number.isFinite(id) && id > 0 && !byId.has(id)) {
          byId.set(id, p);
        }

        if (titleKey && !byTitle.has(titleKey)) {
          byTitle.set(titleKey, p);
        }
      });

      return { byId, byTitle };
    }

    function enrichProducts(primaryProducts, fallbackProducts) {
      const { byId, byTitle } = makeProductLookup(fallbackProducts);

      return (Array.isArray(primaryProducts) ? primaryProducts : []).map((p) => {
        const id = Number(p?.id);
        const titleKey = String(p?.title || "").trim().toLowerCase();

        const fallback =
          (Number.isFinite(id) && id > 0 ? byId.get(id) : null) ||
          (titleKey ? byTitle.get(titleKey) : null) ||
          null;

        if (!fallback) return p;

        return {
          ...fallback,
          ...p,
          image_url: p?.image_url || fallback?.image_url || "",
          images: Array.isArray(p?.images) && p.images.length ? p.images : (fallback?.images || []),
          price:
            p?.price != null && Number.isFinite(Number(p.price)) && Number(p.price) > 0
              ? p.price
              : fallback?.price,
          stock:
            p?.stock != null && Number.isFinite(Number(p.stock))
              ? p.stock
              : fallback?.stock,
          likes:
            p?.likes != null && Number.isFinite(Number(p.likes))
              ? p.likes
              : fallback?.likes,
          rating_avg:
            p?.rating_avg != null && Number.isFinite(Number(p.rating_avg))
              ? p.rating_avg
              : fallback?.rating_avg,
          category: p?.category || fallback?.category || "",
          section: p?.section || fallback?.section || ""
        };
      });
    }

    function renderProductItem(product) {
      const id = Number(product?.id) || 0;
      const title = escapeHtml(product?.title || "Без названия");
      const thumb = getProductThumb(product);
      const price = formatKZT(product?.price);
      const meta = buildProductMeta(product);

      return `
        <button class="searchModal__item" type="button" data-product-id="${id}">
          <div class="searchModal__itemInner">
            <div class="searchModal__thumb">
              ${
                thumb
                  ? `<img src="${escapeHtml(thumb)}" alt="${title}" loading="lazy">`
                  : `<div class="searchModal__thumbFallback">🛒</div>`
              }
            </div>

            <div class="searchModal__text">
              <span class="searchModal__itemMain">${title}</span>

              <div class="searchModal__itemMeta">
                ${
                  meta.length
                    ? meta.map(item => `<span class="searchModal__metaBadge">${escapeHtml(item)}</span>`).join("")
                    : `<span class="searchModal__metaBadge">Товар</span>`
                }
              </div>
            </div>

            <div class="searchModal__itemSide">
              ${price ? `<span class="searchModal__price">${escapeHtml(price)}</span>` : ""}
            </div>
          </div>
        </button>
      `;
    }

    function renderCategoryItem(categoryName) {
      const name = String(categoryName || "").trim();
      if (!name) return "";

      return `
        <button class="searchModal__chip" type="button" data-category-name="${escapeHtml(name)}">
          ${escapeHtml(name)}
        </button>
      `;
    }

    function open() {
      const { modal, input } = getModalEls();
      if (!modal) return;

      modal.classList.add("active");

      const currentQuery =
        getAppApi()?.getQuery?.() ||
        document.getElementById("searchInput")?.value ||
        "";

      if (input) {
        input.value = currentQuery;
        requestAnimationFrame(() => input.focus());
      }

      if (String(currentQuery).trim()) {
        preview(currentQuery);
      } else {
        renderEmptyStart();
      }
    }

    function close() {
      const { modal } = getModalEls();
      if (modal) modal.classList.remove("active");
    }

    async function suggest(q) {
      const text = String(q || "").trim();
      if (!text || text.length < 2) {
        return { products: [], categories: [] };
      }

      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(text)}`);
        if (!res.ok) return { products: [], categories: [] };
        return await res.json().catch(() => ({ products: [], categories: [] }));
      } catch {
        return { products: [], categories: [] };
      }
    }

    async function preview(q) {
      const query = String(q || "").trim();

      if (!query) {
        renderEmptyStart();
        return;
      }

      renderLoading();

      let suggestData = { products: [], categories: [] };
      let previewProducts = [];
      let fullProducts = [];

      try {
        if (getCatalogApi()?.previewProducts) {
          previewProducts = await getCatalogApi().previewProducts(query);
        }
        suggestData = await suggest(query);
        fullProducts = await fetchAllProducts();
      } catch {}

      const rawSuggestProducts = Array.isArray(suggestData?.products) ? suggestData.products : [];
      const enrichedSuggest = enrichProducts(rawSuggestProducts, fullProducts);
      const enrichedPreview = enrichProducts(
        Array.isArray(previewProducts) ? previewProducts : [],
        fullProducts
      );

      const products = enrichedSuggest.length
        ? enrichedSuggest
        : enrichedPreview.slice(0, 8);

      const categories = Array.isArray(suggestData?.categories)
        ? suggestData.categories
        : [];

      if (!products.length && !categories.length) {
        renderNothingFound(query);
        return;
      }

      let html = "";

      if (products.length) {
        html += `
          <div class="searchModal__group">
            <div class="searchModal__groupTitle">Товары</div>
            <div class="searchModal__list">
              ${products.slice(0, 8).map(renderProductItem).join("")}
            </div>
          </div>
        `;
      }

      if (categories.length) {
        html += `
          <div class="searchModal__group">
            <div class="searchModal__groupTitle">Категории</div>
            <div class="searchModal__chips">
              ${categories.slice(0, 8).map(renderCategoryItem).join("")}
            </div>
          </div>
        `;
      }

      html += `
        <div class="searchModal__footer">
          <button class="searchModal__submitAll" type="button" data-submit-search>
            Показать все результаты по запросу “${escapeHtml(query)}”
          </button>
        </div>
      `;

      setResults(html);
    }

    function submit(raw) {
      const q = String(raw || "").trim();
      getAppApi()?.submitQuery?.(q);
      close();
    }

    function bindModalEvents() {
      const { overlay, close: closeBtn, btn, input, results } = getModalEls();

      overlay?.addEventListener("click", close);
      closeBtn?.addEventListener("click", close);
      btn?.addEventListener("click", () => submit(input?.value || ""));

      let timer = null;

      input?.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          preview(input?.value || "");
        }, 180);
      });

      input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit(input?.value || "");
        }
      });

      results?.addEventListener("click", (e) => {
        const productBtn = e.target.closest("[data-product-id]");
        if (productBtn) {
          const id = productBtn.getAttribute("data-product-id");
          if (id) {
            location.href = `product.html?id=${encodeURIComponent(id)}`;
          }
          return;
        }

        const categoryBtn = e.target.closest("[data-category-name]");
        if (categoryBtn) {
          const category = categoryBtn.getAttribute("data-category-name") || "";
          location.href = `category.html?cat=${encodeURIComponent(category)}`;
          return;
        }

        if (e.target.closest("[data-submit-search]")) {
          submit(input?.value || "");
        }
      });
    }

    function bindOpenTriggers() {
      document.addEventListener("focusin", (e) => {
        if (e.target?.id === "searchInput") {
          open();
        }
      });

      document.addEventListener("click", (e) => {
        if (e.target?.id === "searchOpenBtn" || e.target?.closest?.("#searchOpenBtn")) {
          e.preventDefault();
          open();
        }
      });

      document.addEventListener("keydown", (e) => {
        const { modal } = getModalEls();
        if (e.key === "Escape" && modal?.classList.contains("active")) {
          close();
        }
      });
    }

    function init(options) {
      deps = { ...(options || {}) };

      const { modal } = getModalEls();
      if (!modal) return;

      bindModalEvents();
      bindOpenTriggers();
    }

    return {
      init,
      open,
      close,
      preview,
      submit
    };
  }

  window.HomeSearch = createSearchFeature();
})();