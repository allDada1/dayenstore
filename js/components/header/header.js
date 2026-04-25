// js/components/header.js
// Header Variants v1
// Работает только через:
//   <div id="headerMount" data-header="..."></div>
//   <div id="subbarMount" data-subbar="..."></div>
//
// Варианты header:
//   main     -> главная
//   catalog  -> товарные / каталожные страницы
//   account  -> корзина / оплата / аккаунт
//   seller   -> seller pages
//
// Варианты subbar:
//   catalog  -> обычная витрина категорий
//   seller   -> seller links
//   none     -> не рендерить

(function () {
  const headerMountEl = document.getElementById("headerMount");
  const subbarMountEl = document.getElementById("subbarMount");

  if (!headerMountEl && !subbarMountEl) return;

  function getHeaderVariant() {
    return (headerMountEl?.dataset?.header || "catalog").trim().toLowerCase();
  }

  function getSubbarVariant() {
    return (subbarMountEl?.dataset?.subbar || "none").trim().toLowerCase();
  }

  function getTokenAny() {
    try {
      if (window.Auth && typeof Auth.getToken === "function") return Auth.getToken() || "";
      if (window.MarketAPI && typeof MarketAPI.getToken === "function") return MarketAPI.getToken() || "";
    } catch {}
    try {
      return localStorage.getItem("market_token") || localStorage.getItem("token") || "";
    } catch {
      return "";
    }
  }

  function getSessionAny() {
    try {
      if (window.Auth && typeof Auth.getSession === "function") {
        return Auth.getSession() || null;
      }
    } catch {}
    try {
      return JSON.parse(localStorage.getItem("market_session") || "null");
    } catch {
      return null;
    }
  }

  function getCartCountAny() {
    try {
      if (window.MarketStorage && typeof MarketStorage.getCartCount === "function") {
        return MarketStorage.getCartCount();
      }
    } catch {}

    try {
      const cart = JSON.parse(localStorage.getItem("market_cart") || "{}");
      return Object.values(cart).reduce((a, b) => a + (Number(b) || 0), 0);
    } catch {
      return 0;
    }
  }

  function baseBrand() {
    return `
      <a class="brand" href="index.html">
        <span class="brand__dot"></span>
        <span class="brand__name">Store</span>
      </a>
    `;
  }

  function searchBox() {
  return `
    <div class="headerSearch">

      <input
        id="searchInput"
        class="headerSearch__input"
        placeholder="Поиск товаров..."
        autocomplete="off"
      >

      <button
        id="searchOpenBtn"
        class="headerSearch__btn"
        aria-label="Поиск"
      >
        🔍
      </button>

    </div>
  `;
}

  function actionsBlock() {
    return `
      <div class="topbar__actions">
        <button class="iconBtn" id="cartBtn" type="button" title="Корзина">
          🛒 <span class="badge" id="cartBadge" hidden>0</span>
        </button>

        <div class="dropdown notifDrop" id="notifDrop">
          <button class="iconBtn dropdown__btn" id="notifBtn" type="button" title="Уведомления">
            🔔 <span class="badge" id="notifBadge" hidden>0</span>
          </button>
          <div class="dropdown__panel dropdown__panel--right">
            <div class="notifHead">
              <div class="notifHead__title">Уведомления</div>
              <div class="notifHead__actions">
                <button class="notifClearBtn" id="notifClearBtn" type="button" title="Очистить прочитанные">Очистить</button>
              </div>
            </div>
            <div class="notifList" id="notifPanel"></div>
          </div>
        </div>

        <div class="dropdown userDrop" id="userDrop">
          <button class="iconBtn dropdown__btn" type="button" id="profileBtn" title="Профиль">
            👤 <span>Войти</span>
          </button>
          <div class="dropdown__panel dropdown__panel--right">
            <a href="profile.html" id="goProfile">Профиль</a>
            <a href="admin-products.html" id="goAdmin" style="display:none;">Админ товары</a>
            <a href="login.html" id="goLogin">Вход</a>
            <a href="register.html" id="goReg">Регистрация</a>
            <a href="#" id="goLogout" style="display:none;">Выйти</a>
          </div>
        </div>
      </div>
    `;
  }

  function navMain() {
    return `
      <nav class="topNav">
        <a class="topNav__a" href="index.html">Каталог</a>
        <a class="topNav__a" href="about/support.html" id="helpLink">Поддержка</a>
      </nav>
    `;
  }

  function navCatalog() {
    return `
      <nav class="topNav">
        <a class="topNav__a" href="index.html">Главная</a>
        <a class="topNav__a" href="about/support.html">Поддержка</a>
      </nav>
    `;
  }

  function navAccount() {
    return `
      <nav class="topNav">
        <a class="topNav__a" href="index.html">Главная</a>
        <a class="topNav__a" href="profile.html">Профиль</a>
        <a class="topNav__a" href="about/support.html">Поддержка</a>
      </nav>
    `;
  }

  function navSeller() {
    return `
      <nav class="topNav">

      </nav>
    `;
  }

  function headerMain() {
    return `
      <header class="topbar">
        <div class="container topbar__inner topbar__playerok">
          ${baseBrand()}
          ${searchBox()}
          ${navMain()}
          ${actionsBlock()}
        </div>
      </header>
    `;
  }

  function headerCatalog() {
    return `
      <header class="topbar">
        <div class="container topbar__inner topbar__playerok">
          ${baseBrand()}
          ${searchBox()}
          ${navCatalog()}
          ${actionsBlock()}
        </div>
      </header>
    `;
  }

  function headerAccount() {
    return `
      <header class="topbar">
        <div class="container topbar__inner topbar__playerok">
          ${baseBrand()}
          ${navAccount()}
          ${actionsBlock()}
        </div>
      </header>
    `;
  }

  function headerSeller() {
    return `
      <header class="topbar">
        <div class="container topbar__inner topbar__playerok">
          ${baseBrand()}
          ${navSeller()}
          ${actionsBlock()}
        </div>
      </header>
    `;
  }

  function subbarCatalog() {
    return `
      <div class="subbar">
        <div class="container subbar__inner">
          <div class="catDrop" id="catDrop">
            <button class="catBtn" type="button" id="catBtn">Категории ▾</button>
            <div class="catPanel" id="catPanel"></div>
          </div>

          <div class="subLinks" id="subLinks">
            <a href="index.html">Каталог</a>
            <a href="favorites.html">Избранное</a>
          </div>
        </div>
      </div>
    `;
  }

  function subbarSeller() {
    return `
      <div class="subbar">
        <div class="container subbar__inner">
          <div class="subLinks">
            <a href="seller.html">Витрина продавца</a>
            <a href="seller-dashboard.html">Панель продавца</a>
            <a href="seller-products.html">Мои товары</a>
            <a href="seller-sales.html">Мои продажи</a>
            <a href="index.html">На главную</a>
          </div>
        </div>
      </div>
    `;
  }

  function getHeaderHtml(variant) {
    if (variant === "main") return headerMain();
    if (variant === "account") return headerAccount();
    if (variant === "seller") return headerSeller();
    return headerCatalog();
  }

  function getSubbarHtml(variant) {
    if (variant === "catalog") return subbarCatalog();
    if (variant === "seller") return subbarSeller();
    return "";
  }


  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadSubbarCategories() {
    const panel = byId("catPanel");
    const links = byId("subLinks");
    const drop = byId("catDrop");
    const btn = byId("catBtn");
    if (!panel || !links || !drop || !btn) return;

    function closeDrop() {
      drop.classList.remove("is-open");
    }

    if (!drop.dataset.wired) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        drop.classList.toggle("is-open");
      });

      document.addEventListener("click", (e) => {
        if (!drop.contains(e.target)) closeDrop();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDrop();
      });

      drop.dataset.wired = "1";
    }

    try {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json().catch(() => []);
      const list = Array.isArray(rows) ? rows : [];

      const sections = [];
      const sectionSet = new Set();
      const titles = [];
      const titleSet = new Set();

      for (const row of list) {
        const section = String(row?.section || "").trim();
        const title = String(row?.title || "").trim();

        if (section && !sectionSet.has(section)) {
          sectionSet.add(section);
          sections.push(section);
        }

        if (title && !titleSet.has(title)) {
          titleSet.add(title);
          titles.push(title);
        }
      }

      panel.innerHTML = titles.length
        ? titles.map((name) => `<a href="category.html?cat=${encodeURIComponent(name)}">${safeText(name)}</a>`).join("")
        : `<div class="catPanel__empty">Категории пока не добавлены</div>`;

      const dynamicLinks = sections.slice(0, 4).map((name) => `<a href="category.html?cat=${encodeURIComponent(name)}">${safeText(name)}</a>`);
      dynamicLinks.push(`<a href="favorites.html">Избранное</a>`);
      links.innerHTML = dynamicLinks.join("");
    } catch (err) {
      console.error("header categories load error:", err);
      panel.innerHTML = `<div class="catPanel__empty">Не удалось загрузить категории</div>`;
      links.innerHTML = `<a href="index.html">Каталог</a><a href="favorites.html">Избранное</a>`;
    }
  }

  function byId(id) {
    if (id === "headerMount") return headerMountEl;
    if (id === "subbarMount") return subbarMountEl;

    if (headerMountEl) {
      const insideHeader = headerMountEl.querySelector("#" + id);
      if (insideHeader) return insideHeader;
    }

    if (subbarMountEl) {
      const insideSubbar = subbarMountEl.querySelector("#" + id);
      if (insideSubbar) return insideSubbar;
    }

    return document.getElementById(id);
  }

  function mountIfNeeded() {
    const headerVariant = getHeaderVariant();
    const subbarVariant = getSubbarVariant();

    if (headerMountEl && !headerMountEl.dataset.mounted) {
      headerMountEl.innerHTML = getHeaderHtml(headerVariant);
      headerMountEl.dataset.mounted = "1";
    }

    if (subbarMountEl && !subbarMountEl.dataset.mounted) {
      subbarMountEl.innerHTML = getSubbarHtml(subbarVariant);
      subbarMountEl.dataset.mounted = "1";
    }
  }

  function setCartBadge() {
    const badge = byId("cartBadge");
    if (!badge) return;

    const count = getCartCountAny();
    badge.textContent = String(count);
    badge.hidden = count <= 0;
  }

  async function setProfileLabel() {
    const btn = byId("profileBtn");
    if (!btn) return;

    const span = btn.querySelector("span");
    const token = getTokenAny();

    if (!token) {
      if (span) span.textContent = "Войти";
      return;
    }

    try {
      if (window.Auth && typeof Auth.getMe === "function") {
        const me = await Auth.getMe();
        if (span) span.textContent = me?.name ? me.name : "Профиль";
        return;
      }
    } catch {}

    const session = getSessionAny();
    if (span) span.textContent = session?.name ? session.name : "Профиль";
  }

  async function syncAuthMenu() {
    const token = getTokenAny();
    const goLogin = byId("goLogin");
    const goReg = byId("goReg");
    const goProfile = byId("goProfile");
    const goAdmin = byId("goAdmin");
    const goLogout = byId("goLogout");

    if (goLogin) goLogin.style.display = token ? "none" : "";
    if (goReg) goReg.style.display = token ? "none" : "";
    if (goProfile) goProfile.style.display = token ? "" : "none";
    if (goLogout) goLogout.style.display = token ? "" : "none";

    let isAdmin = false;

    try {
      if (token && window.Auth && typeof Auth.getMe === "function") {
        const me = await Auth.getMe();
        isAdmin = !!(me && (me.is_admin || me.role === "admin"));
      }
    } catch {}

    if (!isAdmin) {
      const session = getSessionAny();
      isAdmin = !!(session && (session.is_admin || session.role === "admin"));
    }

    if (goAdmin) goAdmin.style.display = isAdmin ? "" : "none";
  }

  function wireCommonClicks() {
    const cartBtn = byId("cartBtn");
    const goLogin = byId("goLogin");
    const goReg = byId("goReg");
    const goProfile = byId("goProfile");
    const goLogout = byId("goLogout");

    if (cartBtn) {
      cartBtn.addEventListener("click", () => {
        location.href = getTokenAny() ? "cart.html" : "login.html";
      });
    }

    if (goLogin) {
      goLogin.addEventListener("click", (e) => {
        e.preventDefault();
        location.href = "login.html";
      });
    }

    if (goReg) {
      goReg.addEventListener("click", (e) => {
        e.preventDefault();
        location.href = "register.html";
      });
    }

    if (goProfile) {
      goProfile.addEventListener("click", (e) => {
        e.preventDefault();
        location.href = getTokenAny() ? "profile.html" : "login.html";
      });
    }

    if (goLogout) {
      goLogout.addEventListener("click", (e) => {
        e.preventDefault();
        try {
          if (window.Auth && typeof Auth.logout === "function") {
            Auth.logout();
          } else {
            localStorage.removeItem("market_token");
            localStorage.removeItem("market_session");
          }
        } catch {}
        location.href = "index.html";
      });
    }
  }

  function ensureDropdownFallback() {
    if (document.documentElement.dataset.dmDropdowns === "1") return;
    document.documentElement.dataset.dmDropdowns = "1";

    function closeAll(except) {
      document.querySelectorAll(".dropdown.is-open").forEach((d) => {
        if (except && d === except) return;
        d.classList.remove("is-open");
      });
    }

    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".dropdown__btn");
      if (btn) {
        const dd = btn.closest(".dropdown");
        if (!dd) return;
        const open = dd.classList.contains("is-open");
        closeAll(dd);
        dd.classList.toggle("is-open", !open);
        return;
      }

      if (e.target.closest(".dropdown")) return;
      closeAll();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });
  }


  function apiFetchAuth(url, options) {
    const opt = { ...(options || {}) };
    opt.headers = opt.headers ? { ...opt.headers } : {};

    const token = getTokenAny();
    if (token && !opt.headers.Authorization) {
      opt.headers.Authorization = "Bearer " + token;
    }

    return fetch(url, opt);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNotifTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    try {
      return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

  let notifPollTimer = null;
  let notifLoading = false;

  function setNotifBadge(count) {
    const badge = byId("notifBadge");
    if (!badge) return;

    const n = Number(count) || 0;
    badge.textContent = String(n);
    badge.hidden = n <= 0;
  }

  function renderNotifications(items) {
    const panel = byId("notifPanel");
    if (!panel) return;

    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      panel.innerHTML = `<div class="notifEmpty">Уведомлений пока нет</div>`;
      return;
    }

    panel.innerHTML = list.map((item) => {
      const id = Number(item?.id || 0);
      const isRead = !!item?.is_read;
      const link = String(item?.link || "").trim() || "#";
      const title = escapeHtml(item?.title || "Уведомление");
      const body = escapeHtml(item?.body || "");
      const time = escapeHtml(formatNotifTime(item?.created_at));
      return `
        <a class="notifItem ${isRead ? "" : "notifItem--unread"}"
           href="${escapeHtml(link)}"
           data-id="${id}"
           data-read="${isRead ? "1" : "0"}">
          <div class="notifItem__top">
            <div class="notifItem__title">${title}</div>
            <div class="notifItem__time">${time}</div>
          </div>
          <div class="notifItem__body">${body}</div>
        </a>
      `;
    }).join("");
  }

  async function fetchNotifications() {
    if (notifLoading) return;

    const panel = byId("notifPanel");
    const clearBtn = byId("notifClearBtn");
    const token = getTokenAny();

    if (!token) {
      setNotifBadge(0);
      if (panel) panel.innerHTML = `<div class="notifEmpty">Войдите, чтобы видеть уведомления</div>`;
      if (clearBtn) clearBtn.disabled = true;
      return;
    }

    notifLoading = true;
    try {
      if (panel && !panel.dataset.loaded) {
        panel.innerHTML = `<div class="notifEmpty">Загрузка…</div>`;
      }

      const r = await apiFetchAuth("/api/notifications");
      if (!r.ok) {
        setNotifBadge(0);
        if (panel) panel.innerHTML = `<div class="notifEmpty">Не удалось загрузить уведомления</div>`;
        if (clearBtn) clearBtn.disabled = true;
        return;
      }

      const data = await r.json().catch(() => ({}));
      const items = Array.isArray(data?.items) ? data.items : [];
      renderNotifications(items);
      setNotifBadge(Number(data?.unread_count || 0));
      if (panel) panel.dataset.loaded = "1";
      if (clearBtn) clearBtn.disabled = !items.some((item) => !!item?.is_read);
    } finally {
      notifLoading = false;
    }
  }

  async function markNotificationsRead(ids) {
    const list = Array.isArray(ids)
      ? ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
      : [];

    if (!list.length) return;

    try {
      await apiFetchAuth("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: list })
      });
    } catch {}
  }

  function wireNotifications() {
    const drop = byId("notifDrop");
    const btn = byId("notifBtn");
    const panel = byId("notifPanel");
    const clearBtn = byId("notifClearBtn");

    if (!drop || !btn || !panel) return;

    fetchNotifications();

    if (notifPollTimer) {
      clearInterval(notifPollTimer);
      notifPollTimer = null;
    }

    if (getTokenAny()) {
      notifPollTimer = setInterval(fetchNotifications, 30000);
    }

    btn.addEventListener("click", () => {
      setTimeout(async () => {
        if (!drop.classList.contains("is-open")) return;
        await fetchNotifications();

        const unreadIds = Array.from(panel.querySelectorAll('.notifItem[data-read="0"]'))
          .map((el) => Number(el.dataset.id || 0))
          .filter((n) => Number.isFinite(n) && n > 0);

        if (unreadIds.length) {
          await markNotificationsRead(unreadIds);
          await fetchNotifications();
        }
      }, 0);
    });

    panel.addEventListener("click", async (e) => {
      const link = e.target.closest(".notifItem");
      if (!link) return;

      const id = Number(link.dataset.id || 0);
      if (link.dataset.read === "0" && id > 0) {
        await markNotificationsRead([id]);
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", async () => {
        clearBtn.disabled = true;
        try {
          await apiFetchAuth("/api/notifications/clear", { method: "POST" });
        } catch {}
        await fetchNotifications();
      });
    }
  }


  async function updateSellerLinks() {
    const token = getTokenAny();
    let sellerUrl = "seller.html";

    if (token) {
      try {
        if (window.Auth && typeof Auth.getMe === "function") {
          const me = await Auth.getMe();
          const myId = Number(me?.id || 0);
          if (Number.isFinite(myId) && myId > 0) {
            sellerUrl = `seller.html?id=${myId}`;
          }
        }
      } catch {}

      if (sellerUrl === "seller.html") {
        const session = getSessionAny();
        const myId = Number(session?.id || 0);
        if (Number.isFinite(myId) && myId > 0) {
          sellerUrl = `seller.html?id=${myId}`;
        }
      }
    }

    document.querySelectorAll('a[href="seller.html"]').forEach((a) => {
      a.setAttribute("href", sellerUrl);
    });
  }

  function wireSearchFallback() {
    const input = byId("searchInput");
    const clearBtn = byId("clearBtn");
    if (!input || !clearBtn) return;

    clearBtn.addEventListener("click", () => {
      input.value = "";
      try {
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } catch {}
      input.focus();
    });
  }

  async function boot() {
    mountIfNeeded();
    ensureDropdownFallback();
    wireCommonClicks();
    loadSubbarCategories();
    wireSearchFallback();
    wireNotifications();
    setCartBadge();
    await setProfileLabel();
    await syncAuthMenu();
    await updateSellerLinks();
  }

  function onAuthOrCartChanged() {
    setCartBadge();
    setProfileLabel();
    syncAuthMenu();
    updateSellerLinks();
    fetchNotifications();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("market:auth-changed", onAuthOrCartChanged);
  window.addEventListener("market:cart-changed", setCartBadge);

  window.addEventListener("storage", (e) => {
    if (
      e.key === "market_token" ||
      e.key === "market_session" ||
      e.key === "market_cart"
    ) {
      onAuthOrCartChanged();
    }
  });

})();