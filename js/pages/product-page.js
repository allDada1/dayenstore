// js/pages/product-page.js

(function () {
  const el = {
    heroBox: document.getElementById("heroBox"),
    thumbs: document.getElementById("thumbs"),
    galleryPrev: document.getElementById("galleryPrev"),
    galleryNext: document.getElementById("galleryNext"),
    imgBox: document.getElementById("imgBox"),
    tagCat: document.getElementById("tagCat"),
    crumbCat: document.getElementById("crumbCat"),
    crumbTitle: document.getElementById("crumbTitle"),
    topChips: document.getElementById("topChips"),
    title: document.getElementById("title"),
    desc: document.getElementById("desc"),
    sellerLink: document.getElementById("sellerLink"),
    price: document.getElementById("price"),
    addBtn: document.getElementById("addBtn"),
    buyBtn: document.getElementById("buyBtn"),
    note: document.getElementById("noteLine"),
    stockBadge: document.getElementById("stockBadge"),
    likeBtn: document.getElementById("likeBtn"),
    likeText: document.getElementById("likeText"),
    ratingAvg: document.getElementById("ratingAvg"),
    ratingMeta: document.getElementById("ratingMeta"),
    ratingStars: document.getElementById("ratingStars"),
    longText: document.getElementById("longText"),
    specGrid: document.getElementById("specGrid"),
    includesCard: document.getElementById("includesCard"),
    includesList: document.getElementById("includesList"),
    similarSection: document.getElementById("similarSection"),
    similarList: document.getElementById("similarList"),
    boughtTogetherSection: document.getElementById("boughtTogetherSection"),
    boughtTogetherList: document.getElementById("boughtTogetherList"),
    recentSection: document.getElementById("recentSection"),
    recentList: document.getElementById("recentList"),
  };

  let product = null;

  const Data = window.ProductDataFeature;
  const Gallery = window.ProductGalleryFeature;
  const Related = window.ProductRelatedFeature;
  const Reviews = window.ProductReviewsFeature;

  function setNote(t) {
    if (el.note) el.note.textContent = t || "";
  }

  function renderStars(myRating) {
    if (!el.ratingStars) return;
    el.ratingStars.innerHTML = "";

    for (let i = 1; i <= 5; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "starBtn" + (myRating === i ? " is-on" : "");
      b.textContent = "★";
      b.title = `Поставить ${i}`;
      b.addEventListener("click", () => rate(i));
      el.ratingStars.appendChild(b);
    }
  }

  function renderRating(avg, cnt, my) {
    const a = Number(avg) || 0;
    const c = Number(cnt) || 0;
    if (el.ratingAvg) el.ratingAvg.textContent = a ? `⭐ ${a.toFixed(1)}` : "⭐ —";
    if (el.ratingMeta) {
      el.ratingMeta.textContent = c
        ? `Оценок: ${c} • Твоя: ${my ?? "—"}`
        : `Оценок: 0 • Твоя: ${my ?? "—"}`;
    }
    renderStars(my);
  }

  function parseDynamicSpecs(raw) {
    if (!raw) return [];

    let text = String(raw || "").trim();
    if (!text) return [];

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (Array.isArray(item) && item.length >= 2) {
              return [String(item[0] || "").trim(), String(item[1] || "").trim()];
            }
            if (item && typeof item === "object") {
              return [
                String(item.label || item.key || item.name || "").trim(),
                String(item.value || "").trim(),
              ];
            }
            return null;
          })
          .filter((item) => item && item[0] && item[1]);
      }
    } catch {}

    return text
      .split(/\n+/)
      .map((line) => String(line || "").trim())
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf(":");
        if (idx <= 0) return null;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (!key || !value) return null;
        return [key, value];
      })
      .filter(Boolean);
  }

  function renderSpecs(p) {
    if (!el.specGrid) return;

    const baseSpecs = [
      ["Категория", p.category || "—"],
      ["Раздел", p.section || "Игры"],
      ["ID товара", `#${p.id}`],
    ];

    const dynamicSpecs = parseDynamicSpecs(p.specs_json || p.specs || "");

    const merged = [...baseSpecs, ...dynamicSpecs]
      .filter(([k, v]) => String(k || "").trim() && String(v || "").trim());

    el.specGrid.innerHTML = merged.map(([k, v]) => `
      <div class="spec">
        <div class="spec__k">${Data.escapeHtml(k)}</div>
        <div class="spec__v">${Data.escapeHtml(v)}</div>
      </div>
    `).join("");
  }

  function renderIncludes(text) {
    const lines = String(text || "")
      .split(/\n+/)
      .map((x) => x.replace(/^[-•\s]+/, "").trim())
      .filter((x) => x.length > 3)
      .slice(0, 5);

    if (!el.includesCard || !el.includesList) return;

    if (!lines.length) {
      el.includesCard.hidden = true;
      return;
    }

    el.includesCard.hidden = false;
    el.includesList.innerHTML = lines
      .map((x) => `<div class="includesItem">${Data.escapeHtml(x)}</div>`)
      .join("");
  }

  function renderSellerCard(sellerId, seller) {
    if (!el.topChips) return;

    const sid = Number(sellerId || 0);
    const href = sid > 0 ? `seller.html?id=${sid}` : "#";
    const avatar = String(seller?.avatar_url || "").trim();
    const name = seller?.shop_name || seller?.nickname || seller?.name || "Магазин";
    const meta = (seller?.verified || seller?.is_verified)
      ? "Проверенный магазин"
      : "Перейти в магазин";

    el.topChips.innerHTML = `
      <a class="sellerMiniCard" href="${href}">
        <span class="sellerMiniCard__avatar">
          ${
            avatar
              ? `<img src="${Data.escapeHtml(avatar)}" alt="${Data.escapeHtml(name)}">`
              : `<span class="sellerMiniCard__avatarPh">👤</span>`
          }
        </span>
        <span class="sellerMiniCard__text">
          <span class="sellerMiniCard__name">${Data.escapeHtml(name)}</span>
          <span class="sellerMiniCard__meta">${Data.escapeHtml(meta)}</span>
        </span>
      </a>
    `;
  }

  function renderStock(stock) {
    if (!el.stockBadge) return;

    const n = Number(stock || 0);
    el.stockBadge.classList.remove("is-low", "is-out");

    if (n <= 0) {
      el.stockBadge.textContent = "Нет в наличии";
      el.stockBadge.classList.add("is-out");
    } else if (n <= 3) {
      el.stockBadge.textContent = `Осталось ${n}`;
      el.stockBadge.classList.add("is-low");
    } else {
      el.stockBadge.textContent = `В наличии: ${n}`;
    }
  }

  function setLikeUI(isLiked, likes) {
    if (!el.likeBtn || !el.likeText) return;
    el.likeBtn.classList.toggle("is-on", !!isLiked || window.Favorites?.isFavorite?.(product?.id));
    el.likeText.textContent = `♥ ${Number(likes || 0)}`;
  }

  async function toggleLike() {
    if (!product) return;

    if (!Data.token()) {
      const favNow = window.Favorites?.toggleFavorite?.(product.id);
      setLikeUI(favNow, product.likes || 0);
      setNote(favNow ? "Добавлено в избранное на этом устройстве." : "Убрано из избранного.");
      return;
    }

    const res = await MarketAPI.apiFetch(`/api/products/${product.id}/like`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setNote("Не удалось обновить лайк.");

    product.is_liked = typeof data.is_liked !== "undefined" ? !!data.is_liked : !!data.liked;
    product.likes = Number(data.likes || 0);
    setLikeUI(product.is_liked, product.likes);
    setNote(product.is_liked ? "Товар добавлен в избранное." : "Товар убран из избранного.");
  }

  async function rate(value) {
    if (!product) return;
    if (!Data.token()) {
      location.href = "login.html";
      return;
    }

    const res = await MarketAPI.apiFetch(`/api/products/${product.id}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: value })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setNote("Не удалось сохранить оценку.");

    product.my_rating = Number(data.my_rating || value);
    product.rating_avg = Number(data.rating_avg || 0);
    product.rating_count = Number(data.rating_count || 0);
    renderRating(product.rating_avg, product.rating_count, product.my_rating);
    setNote(`Оценка ${value} сохранена.`);
  }

  async function render() {
    const id = Data.getId();

    if (!Number.isFinite(id) || id <= 0) {
      if (el.title) el.title.textContent = "Товар не найден";
      if (el.longText) el.longText.textContent = "Некорректный ID.";
      return;
    }

    const p = await Data.loadProduct(id);
    if (!p) {
      if (el.title) el.title.textContent = "Товар не найден";
      if (el.longText) el.longText.textContent = "Возможно, он был удалён.";
      return;
    }

    product = p;

    const galleryImages = Data.buildImages(product);
    Gallery.setImages(galleryImages);

    if (el.title) el.title.textContent = p.title || "—";
    if (el.crumbTitle) el.crumbTitle.textContent = p.title || "—";

    if (el.desc) {
      el.desc.textContent = "";
      el.desc.style.display = "none";
    }

    if (el.longText) el.longText.textContent = p.description || "Без описания.";
    if (el.price) el.price.textContent = Data.formatKZT(p.price);
    if (el.tagCat) el.tagCat.textContent = p.category || "Категория";

    if (el.crumbCat) {
      el.crumbCat.textContent = p.category || "Категория";
      el.crumbCat.href = p.category
        ? `category.html?cat=${encodeURIComponent(p.category)}`
        : "category.html";
    }

    renderRating(p.rating_avg, p.rating_count, p.my_rating);
    renderSpecs(p);
    renderIncludes(p.description);
    renderStock(p.stock);
    setLikeUI(!!p.is_liked, p.likes || 0);

    const sellerId = Number(p.owner_user_id || 0);
    if (sellerId) {
      const sellerData = await Data.loadSeller(sellerId).catch(() => null);
      const seller = sellerData?.seller || null;
      renderSellerCard(sellerId, seller);
    } else {
      renderSellerCard(0, null);
    }

    const similar = await Data.loadSimilar(p.category, p.id).catch(() => []);
    Related.renderSimilar(similar);

    const categoryRows = await Data.loadCatalogByCategory(p.category).catch(() => []);
    const boughtTogether = Data.pickBoughtTogetherProducts(p, categoryRows);
    Related.renderBoughtTogether(boughtTogether);

    Data.saveRecentlyViewedProduct(p);
    Related.renderRecentlyViewed(Data.getRecentlyViewedProducts(p.id));

    Reviews.load(p.id);
    Reviews.loadPermission?.(p.id);

    const outOfStock = Number(p.stock || 0) <= 0;
    if (el.addBtn) el.addBtn.disabled = outOfStock;
    if (el.buyBtn) el.buyBtn.disabled = outOfStock;
  }

  function bind() {
    el.likeBtn?.addEventListener("click", toggleLike);

    el.addBtn?.addEventListener("click", () => {
      if (!product) return;
      if (Number(product.stock || 0) <= 0) {
        setNote("Товара сейчас нет в наличии.");
        return;
      }
      Data.addToCart(product.id);
      setNote("Добавлено в корзину.");
    });

    el.buyBtn?.addEventListener("click", () => {
      if (!product) return;
      if (Number(product.stock || 0) <= 0) {
        setNote("Товара сейчас нет в наличии.");
        return;
      }
      Data.addToCart(product.id);
      location.href = "checkout.html";
    });

    Reviews.bind(() => Data.getId());
  }

  function init() {
    if (!window.ProductDataFeature || !window.ProductGalleryFeature || !window.ProductRelatedFeature || !window.ProductReviewsFeature) {
      console.error("Product page features are not loaded");
      return;
    }

    Gallery.init({
      els: el,
      escapeHtml: Data.escapeHtml,
      getProduct: () => product
    });

    Related.init({
      els: el,
      escapeHtml: Data.escapeHtml,
      formatKZT: Data.formatKZT,
      buildImages: Data.buildImages
    });

    bind();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();