(function(){
  const H = window.SellerStoreHelpers || {};

  const els = {
    name: document.getElementById("sellerName"),
    meta: document.getElementById("sellerMeta"),
    avatar: document.getElementById("sellerAvatar"),
    grid: document.getElementById("productsGrid"),
    empty: document.getElementById("emptyState"),
    search: document.getElementById("searchInput"),
    clear: document.getElementById("clearBtn"),
    resultMeta: document.getElementById("resultMeta"),
    cartBadge: document.getElementById("cartBadge"),
    profileLink: document.getElementById("profileLink"),
    followBtn: document.getElementById("followBtn"),
    cartBtn: document.getElementById("cartBtn"),
    profileBtn: document.getElementById("profileBtn"),
    loginBtn: document.getElementById("loginBtn"),
    registerBtn: document.getElementById("registerBtn"),
    cover: document.getElementById("sellerCover"),
    badge: document.getElementById("sellerBadge"),
    aboutCard: document.getElementById("sellerAboutCard"),
    about: document.getElementById("sellerAbout"),
    links: document.getElementById("sellerLinks"),
    contactsBlock: document.getElementById("sellerContactsBlock"),
    productsCount: document.getElementById("productsCount"),
    reviewsCount: document.getElementById("reviewsCount"),
    reviewsStatLink: document.getElementById("reviewsStatLink")
  };

  function setUnavailableState(payload = {}){
    const message = String(payload?.message || "Магазин временно недоступен.").trim();
    const adminComment = String(payload?.admin_comment || "").trim();
    const reviewedAt = payload?.reviewed_at ? new Date(payload.reviewed_at).toLocaleString("ru-RU", { hour12: false }) : "";

    document.title = "Store — Магазин временно недоступен";
    if (els.name) els.name.textContent = "Магазин временно недоступен";
    if (els.meta) {
      els.meta.textContent = adminComment
        ? `${message} Комментарий администратора: ${adminComment}${reviewedAt ? ` · ${reviewedAt}` : ""}`
        : message;
    }
    if (els.avatar) els.avatar.textContent = "!";
    if (els.badge) els.badge.hidden = true;
    if (els.followBtn) els.followBtn.hidden = true;
    if (els.aboutCard) els.aboutCard.hidden = true;
    if (els.cover) els.cover.style.removeProperty("background-image");
    if (els.productsCount) els.productsCount.textContent = "0";
    if (els.reviewsCount) els.reviewsCount.textContent = "0";
    if (els.reviewsStatLink) {
      els.reviewsStatLink.setAttribute("aria-disabled", "true");
      els.reviewsStatLink.href = "#";
    }
    if (els.grid) els.grid.innerHTML = "";
    if (els.empty) {
      const titleEl = els.empty.querySelector(".empty__title");
      const textEl = els.empty.querySelector(".empty__text");
      if (titleEl) titleEl.textContent = "Магазин временно недоступен";
      if (textEl) {
        textEl.textContent = adminComment
          ? `Комментарий администратора: ${adminComment}`
          : "Страница продавца сейчас неактивна. Попробуйте позже.";
      }
      els.empty.hidden = false;
    }
  }

  let allProducts = [];

  function initHeader(){
    const token = H.getTokenAny?.() || "";

    if (els.profileLink) {
      els.profileLink.href = token ? "profile.html" : "login.html";
      els.profileLink.addEventListener("click", (e) => {
        e.preventDefault();
        location.href = token ? "profile.html" : "login.html";
      });
    }

    if (els.cartBtn) {
      els.cartBtn.addEventListener("click", () => {
        location.href = token ? "cart.html" : "login.html";
      });
    }

    if (els.profileBtn) {
      els.profileBtn.addEventListener("click", (e) => {
        e.preventDefault();
        location.href = token ? "profile.html" : "login.html";
      });
    }

    if (els.loginBtn) els.loginBtn.style.display = token ? "none" : "";
    if (els.registerBtn) els.registerBtn.style.display = token ? "none" : "";
  }

  function cartCount(){
    try {
      const cart = JSON.parse(localStorage.getItem("market_cart") || "{}");
      return Object.values(cart).reduce((sum, value) => sum + (Number(value) || 0), 0);
    } catch {
      return 0;
    }
  }

  function updateCartBadge(){
    if (els.cartBadge) {
      els.cartBadge.textContent = String(cartCount());
    }
  }

  function getSellerId(){
    const raw = String(new URLSearchParams(location.search).get("id") || "").trim();
    const id = Number(raw || 0);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  async function resolveSellerId(){
    const explicitId = getSellerId();
    if (explicitId > 0) return explicitId;

    const me = await H.getMyUser?.();
    const myId = Number(me?.id || 0);
    return Number.isFinite(myId) && myId > 0 ? myId : 0;
  }

  function cardTemplate(product){
    const img = String(product.image_url || "").trim();
    const imgHtml = img
      ? `<img src="${H.escapeHtml(product.image_url)}" alt="">`
      : `<div class="ph">Фото</div>`;

    return `
      <article class="card" data-id="${product.id}">
        <div class="card__img">
          ${imgHtml}
          <div class="card__tag">${H.escapeHtml(product.category)}</div>
          <div class="card__stat">
            <div class="pillStat">♥ ${Number(product.likes || 0)}</div>
            <div class="pillStat">${H.starsSmall(product.rating_avg)}</div>
          </div>
        </div>
        <div class="card__body">
          <h3 class="card__title">${H.escapeHtml(product.title)}</h3>
          <p class="card__desc">${H.escapeHtml(product.description)}</p>
          <div class="card__row">
            <div>
              <div class="price">${H.formatKZT(product.price)}</div>
              <div class="mini">В наличии: ${Number(product.stock) || 0}</div>
            </div>
            <button class="btn btn--primary" type="button" data-open>Открыть</button>
          </div>
        </div>
      </article>
    `;
  }

  function bindCards(){
    if (!els.grid) return;

    els.grid.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.closest(".card")?.dataset?.id;
        if (id) location.href = `product.html?id=${id}`;
      });
    });

    els.grid.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", () => {
        location.href = `product.html?id=${card.dataset.id}`;
      });
    });
  }

  function getActiveSort(){
    return document.querySelector(".sellerChip.is-active")?.dataset.sort || "default";
  }

  function sortProducts(list, sort){
    if (sort === "price_asc") {
      list.sort((a, b) => (a.price || 0) - (b.price || 0));
      return;
    }

    if (sort === "price_desc") {
      list.sort((a, b) => (b.price || 0) - (a.price || 0));
      return;
    }

    if (sort === "title") {
      list.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ru"));
    }
  }

  function renderProducts(list){
    if (!els.grid) return;

    if (window.ProductCard?.template) {
      els.grid.innerHTML = list.map((product) => window.ProductCard.template(product, new Set())).join("");
      window.ProductCard.bindClicks?.(els.grid, (productId) => {
        if (window.MarketStorage?.addToCart) {
          window.MarketStorage.addToCart(productId, 1);
        } else if (window.MarketUtils?.addToCart) {
          window.MarketUtils.addToCart(productId, 1);
        }
        updateCartBadge();
        window.UI?.toast?.("Товар добавлен в корзину", "success");
      });
    } else {
      els.grid.innerHTML = list.map(cardTemplate).join("");
      bindCards();
    }

    H.applyCardEnhancements?.(els.grid);
  }

  function applyFilter(){
    const q = String(els.search?.value || "").trim().toLowerCase();
    const list = !q
      ? [...allProducts]
      : allProducts.filter((product) => {
          const text = `${product.title || ""} ${product.description || ""} ${product.category || ""}`.toLowerCase();
          return text.includes(q);
        });

    sortProducts(list, getActiveSort());
    renderProducts(list);

    if (els.empty) els.empty.hidden = list.length > 0;
    if (els.resultMeta) els.resultMeta.textContent = list.length ? `Товаров: ${list.length}` : "";
  }

  function renderBanner(seller){
    if (!els.cover || !seller?.banner_url) return;
    els.cover.style.setProperty("--banner", `url(${seller.banner_url})`);
    els.cover.style.setProperty("background-image", `url(${seller.banner_url})`);
  }

  function renderAboutSection(seller){
    if (!els.aboutCard || !els.about || !els.links) return;

    const aboutText = String(seller?.about || "").trim();
    const linksCount = H.renderSellerLinks?.(els.links, seller) || 0;
    const hasAbout = !!aboutText;
    const hasLinks = linksCount > 0;

    els.about.textContent = hasAbout ? aboutText : "";
    if (els.contactsBlock) els.contactsBlock.hidden = !hasLinks;
    els.aboutCard.hidden = !hasAbout && !hasLinks;
  }

  function renderHeader(profileResponse){
    const seller = profileResponse?.seller || {};
    const displayName = seller.nickname ? seller.nickname : seller.name;

    document.title = `Store — Магазин: ${displayName}`;
    if (els.name) els.name.textContent = displayName;
    if (els.meta) els.meta.textContent = seller.nickname ? `${seller.name}` : "Продавец";
    if (els.badge) els.badge.hidden = false;
    if (els.productsCount) els.productsCount.textContent = profileResponse?.stats?.products_count || 0;
    if (els.reviewsCount) els.reviewsCount.textContent = profileResponse?.stats?.review_count || 0;
    if (els.reviewsStatLink) {
      const sellerId = seller?.id || "";
      els.reviewsStatLink.href = sellerId ? `seller-reviews.html?id=${sellerId}` : "#";
      els.reviewsStatLink.removeAttribute("aria-disabled");
    }

    renderBanner(seller);
    renderAboutSection(seller);

    if (els.avatar) {
      if (seller.avatar_url) {
        els.avatar.innerHTML = `<img src="${H.escapeHtml(seller.avatar_url)}" alt="">`;
      } else {
        els.avatar.textContent = String(displayName || "S").slice(0, 1).toUpperCase();
      }
    }
  }

  async function setupFollow(sellerId){
    if (!els.followBtn) return;

    const me = await H.getMyUser?.();
    if (!me) {
      els.followBtn.hidden = false;
      els.followBtn.textContent = "Войти, чтобы подписаться";
      els.followBtn.onclick = () => { location.href = "login.html"; };
      return;
    }

    if (Number(me.id) === Number(sellerId)) {
      els.followBtn.hidden = false;
      els.followBtn.disabled = true;
      els.followBtn.textContent = "Это ваш магазин";
      return;
    }

    els.followBtn.hidden = false;

    async function refresh(){
      const response = await H.apiFetch?.(`/api/sellers/${sellerId}/following`);
      const data = response?.ok ? await response.json().catch(() => ({})) : {};
      const following = !!data.following;
      els.followBtn.dataset.following = following ? "1" : "0";
      els.followBtn.textContent = following ? "Отписаться" : "Подписаться";
    }

    els.followBtn.onclick = async () => {
      els.followBtn.disabled = true;
      try {
        const isFollowing = els.followBtn.dataset.following === "1";
        const method = isFollowing ? "DELETE" : "POST";
        const response = await H.apiFetch?.(`/api/sellers/${sellerId}/follow`, { method });
        if (!response?.ok) {
          const error = await response?.json?.().catch(() => ({}));
          alert("Ошибка: " + (error?.error || response?.status || "unknown"));
          return;
        }
        await refresh();
      } finally {
        els.followBtn.disabled = false;
      }
    };

    await refresh();
  }

  async function load(){
    const sellerId = await resolveSellerId();
    if (!sellerId) {
      if (els.name) els.name.textContent = "Магазин не найден";
      if (els.meta) els.meta.textContent = "Не удалось определить продавца. Открой витрину по ссылке с id или войди в свой аккаунт.";
      if (els.empty) els.empty.hidden = false;
      return;
    }

    try {
      const url = new URL(location.href);
      if (!url.searchParams.get("id")) {
        url.searchParams.set("id", String(sellerId));
        history.replaceState(null, "", url.toString());
      }
    } catch {}

    if (els.grid) els.grid.innerHTML = H.skeletonCards?.(8) || "";

    const profileResponse = await fetch(`/api/sellers/${sellerId}`);
    const profileData = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok) {
      if (profileData?.error === "seller_inactive") {
        setUnavailableState(profileData);
        return;
      }
      if (els.name) els.name.textContent = "Магазин не найден";
      if (els.meta) els.meta.textContent = "Продавец не существует или удалён.";
      if (els.empty) els.empty.hidden = false;
      return;
    }

    renderHeader(profileData);

    const productsResponse = await fetch(`/api/sellers/${sellerId}/products`);
    const productsData = productsResponse.ok ? await productsResponse.json().catch(() => []) : [];
    const rawItems = Array.isArray(productsData)
      ? productsData
      : (Array.isArray(productsData?.items) ? productsData.items : []);

    allProducts = window.ProductNormalizer?.normalizeList
      ? window.ProductNormalizer.normalizeList(rawItems)
      : rawItems;

    applyFilter();
    setupFollow(sellerId).catch(console.error);
  }

  function bindSortChips(){
    document.querySelectorAll(".sellerChip").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".sellerChip").forEach((chip) => chip.classList.remove("is-active"));
        btn.classList.add("is-active");
        applyFilter();
      });
    });
  }

  initHeader();
  updateCartBadge();
  bindSortChips();

  window.addEventListener("storage", (e) => {
    if (e.key === "market_cart") updateCartBadge();
  });

  els.clear?.addEventListener("click", () => {
    if (els.search) els.search.value = "";
    applyFilter();
  });

  els.search?.addEventListener("input", applyFilter);

  load().catch((err) => {
    console.error(err);
    if (els.name) els.name.textContent = "Ошибка";
    if (els.meta) els.meta.textContent = "Не удалось загрузить магазин.";
    if (els.empty) els.empty.hidden = false;
  });
})();
