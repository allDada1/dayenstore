(function () {
  function getSlug() {
    // /shop/<slug>
    const parts = location.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("shop");
    const slug = (i >= 0 && parts[i + 1]) ? parts[i + 1] : "";
    return decodeURIComponent(slug || "").toLowerCase();
  }

  const slug = getSlug();

  const nameEl = document.getElementById("shopName");
  const slugEl = document.getElementById("shopSlug");
  const bioEl = document.getElementById("shopBio");
  const avaImg = document.getElementById("shopAvatar");
  const avaPh = document.getElementById("shopAvatarPh");

  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function priceFmt(n) {
    const x = Number(n || 0);
    return x.toLocaleString("ru-RU") + " ₸";
  }

  function starsSmall(avg) {
    const a = Number(avg) || 0;
    return a ? `⭐ ${a.toFixed(1)}` : "⭐ —";
  }

  function getTag(p) {
    const cat = String(p.category || "").trim();
    if (cat && cat !== "Разное") return cat;
    const t = String(p.tile_slug || "").trim();
    return t || cat || "Разное";
  }

  function getPlaceholderLabel(p) {
    const a = String(p.tile_slug || "").trim();
    const b = String(p.category || "").trim();
    const t = String(p.title || "").trim();
    return (a || b || (t ? t[0] : "•")).slice(0, 10);
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
      card.classList.add("is-entering");
      card.style.setProperty("--stagger", String(index % 12));
      card.addEventListener("animationend", () => card.classList.remove("is-entering"), { once: true });
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
  }

  function cardTemplate(p) {
    const id = Number(p.id);
    const title = esc(p.title || "—");
    const tag = esc(getTag(p));
    const price = priceFmt(p.price);
    const img = String(p.image_url || "").trim();
    const ph = esc(getPlaceholderLabel(p));

    const likes = Number(p.likes || 0);
    const ratingAvg = Number(p.rating_avg || 0);

    const imgHtml = img
      ? `<img src="${esc(img)}" alt="${title}" loading="lazy"
           onerror="this.style.display='none'; this.parentElement.querySelector('.ph').style.display='grid';">`
      : "";

    // Standard card markup (same as main pages) so styles match.
    // Whole card is clickable.
    return `
      <article class="card" data-id="${id}">
        <div class="card__img">
          ${imgHtml}
          <div class="ph" style="display:${img ? "none" : "grid"}">${ph}</div>
          <div class="card__tag">${tag}</div>
          <div class="card__stat">
            <div class="pillStat">♥ ${likes}</div>
            <div class="pillStat">${starsSmall(ratingAvg)}</div>
          </div>
        </div>

        <div class="card__body">
          <h3 class="card__title" title="${title}">${title}</h3>
          <p class="card__desc">&nbsp;</p>

          <div class="card__row">
            <div>
              <div class="price">${price}</div>
              <div class="mini">&nbsp;</div>
            </div>
            <button class="btn btn--primary" type="button" data-open>Открыть</button>
          </div>
        </div>
      </article>
    `;
  }

  function bindClicks() {
    if (!grid) return;

    grid.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.closest(".card")?.dataset?.id;
        if (id) location.href = `product.html?id=${id}`;
      });
    });

    grid.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        if (id) location.href = `product.html?id=${id}`;
      });
    });
  }

  async function load() {
    try {
      const res = await fetch(`/api/shop/${encodeURIComponent(slug)}`, {
        headers: { "Accept": "application/json" }
      });

      if (!res.ok) {
        nameEl.textContent = "Магазин не найден";
        slugEl.textContent = "";
        bioEl.textContent = "";
        empty.hidden = false;
        grid.innerHTML = "";
        return;
      }

      const data = await res.json();
      const s = data.seller || {};
      const list = data.products || [];

      // server returns: username, avatar_url, about
      nameEl.textContent = s.username || s.name || "—";
      slugEl.textContent = "/shop/" + (s.username || slug);
      bioEl.textContent = s.about ? String(s.about) : "—";

      const ava = String(s.avatar_url || "").trim();
      if (ava) {
        avaImg.src = ava;
        avaImg.style.display = "block";
        avaPh.style.display = "none";
        avaImg.onerror = () => {
          avaImg.style.display = "none";
          avaPh.style.display = "flex";
        };
      } else {
        avaImg.style.display = "none";
        avaPh.style.display = "flex";
      }

      if (!list.length) {
        empty.hidden = false;
        grid.innerHTML = "";
        return;
      }

      empty.hidden = true;
      if (window.ProductCard?.template) {
        grid.innerHTML = list.map((p) => window.ProductCard.template(p, new Set())).join("");
        window.ProductCard.bindClicks(grid, null, null);
      } else {
        grid.innerHTML = list.map(cardTemplate).join("");
        bindClicks();
      }
      applyCardEnhancements(grid);
    } catch {
      nameEl.textContent = "Ошибка загрузки магазина";
      slugEl.textContent = "";
      bioEl.textContent = "";
      empty.hidden = false;
      grid.innerHTML = "";
    }
  }

  if (grid) grid.innerHTML = skeletonCards(8);
  load();
})();
