(function(){
  function escapeHtml(str){
    return String(str ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function formatKZT(value){
    const s = String(Math.round(Number(value) || 0));
    const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${spaced} ₸`;
  }

  function starsSmall(avg){
    const a = Number(avg) || 0;
    return a ? `⭐ ${a.toFixed(1)}` : "⭐ —";
  }

  function skeletonCards(count = 8){
    return Array.from({ length: count }, () => `
      <article class="skeletonCard" aria-hidden="true">
        <div class="skeletonCard__img"></div>
        <div class="skeletonCard__body">
          <div class="skeletonTop">
            <div class="skeletonPill skeletonPill--sm"></div>
            <div class="skeletonPill skeletonPill--xs"></div>
          </div>
          <div class="skeletonLine skeletonLine--title"></div>
          <div class="skeletonLine skeletonLine--text"></div>
          <div class="skeletonLine skeletonLine--text2"></div>
          <div class="skeletonRow">
            <div>
              <div class="skeletonLine skeletonPrice"></div>
              <div class="skeletonLine skeletonMini"></div>
            </div>
            <div class="skeletonBtn"></div>
          </div>
        </div>
      </article>
    `).join("");
  }

  function applyCardEnhancements(container){
    if (!container) return;

    container.querySelectorAll(".card").forEach((card, index) => {
      card.style.setProperty("--stagger", String(index % 12));
      if (!card.dataset.enhanced) {
        card.classList.add("is-entering");
        card.addEventListener("animationend", () => {
          card.classList.remove("is-entering");
        }, { once: true });
        card.dataset.enhanced = "1";
      }
    });

    container.querySelectorAll("img").forEach((img) => {
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      img.setAttribute("fetchpriority", "low");
      img.setAttribute("draggable", "false");
    });
  }

  function getTokenAny(){
    try {
      const t = (window.MarketAPI && typeof window.MarketAPI.getToken === "function")
        ? (window.MarketAPI.getToken() || "")
        : "";
      return t ||
        localStorage.getItem("market_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        localStorage.getItem("accessToken") ||
        "";
    } catch {
      return localStorage.getItem("market_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        localStorage.getItem("accessToken") ||
        "";
    }
  }

  function apiFetch(url, options){
    if (window.MarketAPI && typeof window.MarketAPI.apiFetch === "function") {
      return window.MarketAPI.apiFetch(url, options);
    }

    const opt = { ...(options || {}) };
    opt.headers = opt.headers ? { ...opt.headers } : {};
    const token = getTokenAny();
    if (token && !opt.headers.Authorization) {
      opt.headers.Authorization = "Bearer " + token;
    }
    return fetch(url, opt);
  }

  async function getMyUser(){
    const token = getTokenAny();
    if (!token) return null;

    const response = await fetch("/api/auth/me", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    return data.user || null;
  }

  function normalizeSocialUrl(value, type){
    if (!value) return "";

    let v = String(value).trim();
    if (!v) return "";

    if (type === "telegram") {
      if (v.startsWith("@")) return "https://t.me/" + v.slice(1);
      if (v.startsWith("t.me/")) return "https://" + v;
    }

    if (type === "whatsapp") {
      if (/^\+?\d+$/.test(v.replace(/\s+/g, ""))) {
        return "https://wa.me/" + v.replace(/[^\d]/g, "");
      }
      if (v.startsWith("wa.me/")) return "https://" + v;
    }

    if (!/^https?:\/\//i.test(v)) {
      v = "https://" + v;
    }

    return v;
  }

  function getSocialIcon(type){
    const icons = {
      telegram: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 4.2c.3-.2.7.1.6.5l-3.1 14.7c-.1.4-.6.6-1 .4l-4.8-3.5-2.3 2.2c-.2.2-.4.3-.7.3l.3-4.9 8.9-8.1c.2-.2 0-.5-.2-.3l-11 6.9-4.7-1.5c-.5-.2-.5-.8 0-1L21.6 4.2z"/></svg>`,
      instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zm4.8-3.1a1.1 1.1 0 1 1-1.1 1.1 1.1 1.1 0 0 1 1.1-1.1z"/></svg>`,
      whatsapp: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1 1 12 20zm4.3-5.7c-.2-.1-1.3-.6-1.5-.7-.2-.1-.4-.1-.5.1l-.7.8c-.1.1-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.1-1.4-1.3-1.6-.1-.2 0-.3.1-.4l.4-.4c.1-.1.2-.2.2-.4.1-.1 0-.3 0-.4s-.5-1.2-.7-1.6c-.2-.4-.4-.4-.5-.4h-.4c-.1 0-.4.1-.6.3s-.8.8-.8 1.9.8 2.2.9 2.4c.1.2 1.6 2.4 3.8 3.4 2.2 1 2.2.7 2.6.7.4 0 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.2-.1-.5-.2z"/></svg>`,
      tiktok: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.5 2h2.8a4.7 4.7 0 0 0 4.7 4.7v2.8a7.4 7.4 0 0 1-4.7-1.7v7.2a5.8 5.8 0 1 1-5.8-5.8c.4 0 .8 0 1.2.1v2.9a2.9 2.9 0 1 0 1.8 2.7V2z"/></svg>`
    };
    return icons[type] || "";
  }

  function renderSellerLinks(container, seller){
    if (!container) return 0;

    const socialEntries = [
      [seller?.telegram, "telegram"],
      [seller?.instagram, "instagram"],
      [seller?.whatsapp, "whatsapp"],
      [seller?.tiktok, "tiktok"]
    ];

    container.innerHTML = "";

    socialEntries.forEach(([value, type]) => {
      const href = normalizeSocialUrl(value, type);
      if (!href) return;

      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = `sellerSocial sellerSocial--${type}`;
      a.innerHTML = getSocialIcon(type);
      container.appendChild(a);
    });

    return container.children.length;
  }

  window.SellerStoreHelpers = {
    escapeHtml,
    formatKZT,
    starsSmall,
    skeletonCards,
    applyCardEnhancements,
    getTokenAny,
    apiFetch,
    getMyUser,
    renderSellerLinks
  };
})();
