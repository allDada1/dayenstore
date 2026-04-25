(function(){
  const api = window.SellerProductsAPI || {};
  const errLine = api.errLine || ((t) => { const el = document.getElementById("errLine"); if (el) el.textContent = t || ""; });
  const countText = api.countText || ((t) => { const el = document.getElementById("countText"); if (el) el.textContent = t || ""; });
  const fetchJson = api.fetchJson || (async (url, opt) => {
    const r = await fetch(url, opt);
    let data = null;
    try { data = await r.json(); } catch { data = null; }
    if (!r.ok) throw new Error(data?.error || `http_${r.status}`);
    return data;
  });
  const tokenFromApi = api.token || (() => "");

  const ui = {
    title: document.getElementById("title"),
    desc: document.getElementById("desc"),
    price: document.getElementById("price"),
    stock: document.getElementById("stock"),
    tileSel: document.getElementById("tileSel"),
    countText: document.getElementById("countText"),
    errLine: document.getElementById("errLine"),
    list: document.getElementById("list"),
    listMeta: document.getElementById("listMeta"),
    pagination: document.getElementById("sellerProductsPagination"),
    addBtn: document.getElementById("addBtn"),
    resetBtn: document.getElementById("resetBtn"),
    uploadBox: document.getElementById("uploadBox"),
    fileInput: document.getElementById("fileInput"),
    pickFilesBtn: document.getElementById("pickFilesBtn"),
    clearImagesBtn: document.getElementById("clearImagesBtn"),
    imageGrid: document.getElementById("imageGrid"),
    imageUrlText: document.getElementById("imageUrlText"),
    prodSpecs: document.getElementById("prodSpecs"),
    prodSpecsList: document.getElementById("prodSpecsList"),
    addSpecRowBtn: document.getElementById("addSpecRowBtn")
  };

  const PAGE_SIZE = 8;

  function humanizeSellerProductsError(code) {
    const value = String(code || '').trim();
    const map = {
      seller_only: 'Доступ продавца сейчас отключён. Управление товарами временно недоступно.',
      no_token: 'Сначала войди в аккаунт.',
      upload_failed: 'Не удалось загрузить изображение.'
    };
    return map[value] || '';
  }

  function formatSellerOnlyMessage(payload) {
    const base = String(payload?.message || '').trim() || humanizeSellerProductsError(payload?.error);
    const comment = String(payload?.admin_comment || '').trim();
    return comment ? `${base} Комментарий администратора: ${comment}` : (base || 'Доступ продавца сейчас отключён.');
  }

  async function loadMineWithAccessHandling(){
    const response = await (api.apiFetchCompat
      ? api.apiFetchCompat('/api/seller/products')
      : fetch('/api/seller/products', { headers: { Authorization: 'Bearer ' + token() } }));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data?.error === 'seller_only') {
        const friendly = formatSellerOnlyMessage(data);
        allProducts = [];
        currentPage = 1;
        renderList();
        if (ui.listMeta) ui.listMeta.textContent = 'Управление товарами временно недоступно';
        if (ui.addBtn) ui.addBtn.disabled = true;
        if (ui.resetBtn) ui.resetBtn.disabled = true;
        throw new Error(friendly);
      }
      throw new Error(data?.error || `http_${response.status}`);
    }
    if (ui.addBtn) ui.addBtn.disabled = false;
    if (ui.resetBtn) ui.resetBtn.disabled = false;
    return data;
  }

  const tilesMap = new Map();
  let currentImages = [];
  let editingId = null;
  let allProducts = [];
  let currentPage = 1;

  function token(){
    try{
      if (window.Auth && typeof Auth.getToken === "function") return Auth.getToken() || "";
      const t = tokenFromApi();
      if (t) return t;
      if (window.MarketAPI && typeof MarketAPI.getToken === "function") return MarketAPI.getToken() || "";
    }catch{}
    return localStorage.getItem("market_token") || localStorage.getItem("token") || "";
  }

  function esc(s){
    return String(s || "").replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  }

  function formatKZT(v){
    const s = String(Math.round(Number(v) || 0));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";
  }

  function getImagesFromProduct(product){
    const imgs = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
    return imgs.length ? imgs : (product?.image_url ? [product.image_url] : []);
  }

  function normalizeSpecRows(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") {
          const idx = item.indexOf(":");
          if (idx <= 0) return null;
          return { key: item.slice(0, idx).trim(), value: item.slice(idx + 1).trim() };
        }
        return {
          key: String(item.key || item.label || item.name || "").trim(),
          value: String(item.value || "").trim()
        };
      })
      .filter((item) => item && item.key && item.value)
      .slice(0, 30);
  }

  function parseSpecsInput(text) {
    return normalizeSpecRows(
      String(text || "")
        .split(/\r?\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const idx = line.indexOf(":");
          if (idx <= 0) return null;
          return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
        })
    );
  }

  function parseStoredSpecs(value) {
    if (Array.isArray(value)) return normalizeSpecRows(value);
    if (!value) return [];
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? normalizeSpecRows(parsed) : [];
    } catch {
      return parseSpecsInput(value);
    }
  }

  function specsToTextarea(value) {
    return parseStoredSpecs(value)
      .map((item) => `${String(item?.key || "").trim()}: ${String(item?.value || "").trim()}`.trim())
      .filter(Boolean)
      .join("\n");
  }

  function getSpecRowsFromUi(options = {}) {
    const { keepDrafts = false } = options;
    if (!ui.prodSpecsList) return parseSpecsInput(ui.prodSpecs?.value || "");

    const rows = Array.from(ui.prodSpecsList.querySelectorAll(".specRow")).map((row) => ({
      key: row.querySelector("[data-spec-key]")?.value || "",
      value: row.querySelector("[data-spec-value]")?.value || ""
    }));

    if (keepDrafts) {
      return rows.map((item) => ({
        key: String(item?.key || ""),
        value: String(item?.value || "")
      }));
    }

    return normalizeSpecRows(rows);
  }

  function syncSpecsHidden() {
    if (!ui.prodSpecs) return;
    ui.prodSpecs.value = specsToTextarea(getSpecRowsFromUi());
  }

  function renderSpecRows(value) {
    if (!ui.prodSpecsList) return;

    let rows = [];
    if (Array.isArray(value)) {
      rows = value.map((item) => ({
        key: String(item?.key || item?.label || item?.name || ""),
        value: String(item?.value || "")
      }));
    } else {
      rows = parseStoredSpecs(value);
    }

    const source = rows.length ? rows : [{ key: "", value: "" }];

    ui.prodSpecsList.innerHTML = source.map((item, index) => `
      <div class="specRow" data-spec-index="${index}">
        <input class="input specRow__input" data-spec-key placeholder="Название" value="${esc(item.key || "")}" />
        <input class="input specRow__input" data-spec-value placeholder="Значение" value="${esc(item.value || "")}" />
        <button class="smallBtn specRow__remove" type="button" data-spec-remove ${source.length === 1 && !(item.key || item.value) ? "disabled" : ""}>Удалить</button>
      </div>
    `).join("");

    syncSpecsHidden();
  }

  function addSpecRow(data = {}) {
    const rows = getSpecRowsFromUi({ keepDrafts: true });
    rows.push({ key: String(data.key || ""), value: String(data.value || "") });
    renderSpecRows(rows);
  }

  function bindSpecEditor() {
    ui.addSpecRowBtn?.addEventListener("click", () => addSpecRow());
    ui.prodSpecsList?.addEventListener("input", (e) => {
      if (e.target?.matches?.("[data-spec-key], [data-spec-value]")) syncSpecsHidden();
    });
    ui.prodSpecsList?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-spec-remove]");
      if (!btn) return;
      const row = btn.closest(".specRow");
      if (!row) return;
      const rows = getSpecRowsFromUi({ keepDrafts: true });
      const idx = Number(row.dataset.specIndex || -1);
      if (idx >= 0) rows.splice(idx, 1);
      renderSpecRows(rows.length ? rows : [{ key: "", value: "" }]);
    });
  }

  async function uploadImage(file){
    const t = token();
    if (!t) throw new Error("no_token");
    const fd = new FormData();
    fd.append("image", file);
    const r = await fetch("/api/uploads/image?token=" + encodeURIComponent(t), {
      method: "POST",
      headers: { Authorization: "Bearer " + t, "X-Market-Token": t },
      body: fd
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "upload_failed");
    return data.url;
  }

  function renderImageGrid(){
    if (!ui.imageGrid || !ui.imageUrlText) return;
    if (!currentImages.length) {
      ui.imageGrid.innerHTML = "";
      ui.imageUrlText.textContent = "Фото не выбраны";
      return;
    }

    ui.imageUrlText.textContent = `Загружено фото: ${currentImages.length}`;
    ui.imageGrid.innerHTML = currentImages.map((url, idx) => `
      <div class="imageChip ${idx === 0 ? "is-cover" : ""}" data-idx="${idx}">
        <img src="${esc(url)}" alt="" />
        <div class="imageChip__actions">
          <button class="smallBtn" type="button" data-image-act="cover">Обложка</button>
          <button class="smallBtn" type="button" data-image-act="left">←</button>
          <button class="smallBtn" type="button" data-image-act="right">→</button>
          <button class="smallBtn" type="button" data-image-act="del">Удалить</button>
        </div>
      </div>
    `).join("");
  }

  function setImages(images){
    currentImages = Array.from(new Set((images || []).map((s) => String(s || "").trim()).filter(Boolean)));
    renderImageGrid();
  }

  async function addFiles(files){
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    errLine("Загрузка фото...");
    try {
      for (const file of list) {
        const url = await uploadImage(file);
        currentImages.push(url);
        renderImageGrid();
      }
      currentImages = Array.from(new Set(currentImages));
      renderImageGrid();
      errLine("Фото загружены ✅");
    } catch (e) {
      errLine("Ошибка загрузки: " + (e.message || "unknown"));
    } finally {
      if (ui.fileInput) ui.fileInput.value = "";
    }
  }

  function rowCard(product){
    const images = getImagesFromProduct(product);
    const cover = images[0] || "";
    const specs = parseStoredSpecs(product?.specs || product?.specs_json);
    return `
      <article class="sellerProductRow" data-id="${product.id}">
        <div class="sellerProductRow__main">
          <div class="sellerProductRow__thumb">
            ${cover ? `<img src="${esc(cover)}" alt="">` : `<span class="muted">Фото</span>`}
          </div>
          <div class="sellerProductRow__info">
            <div class="sellerProductRow__title">#${product.id} — ${esc(product.title)}</div>
            <div class="sellerProductRow__desc">${esc(product.description || "")}</div>
            <div class="sellerProductRow__chips">
              <span class="sellerMiniChip">Плитка: ${esc(product.category || product.tile_slug || "—")}</span>
              <span class="sellerMiniChip">Фото: ${images.length}</span>
              <span class="sellerMiniChip">Характеристик: ${specs.length}</span>
            </div>
          </div>
        </div>
        <div class="sellerProductRow__stats">
          <div class="sellerProductStat">
            <span>Цена</span>
            <b>${formatKZT(product.price)}</b>
          </div>
          <div class="sellerProductStat">
            <span>Остаток</span>
            <b>${Number(product.stock || 0)} шт.</b>
          </div>
        </div>
        <div class="sellerProductRow__actions">
          <button class="btn btn--ghost" type="button" data-act="open">Открыть</button>
          <button class="btn btn--ghost" type="button" data-act="edit">Изменить</button>
          <button class="btn" type="button" data-act="del">Удалить</button>
        </div>
      </article>
    `;
  }

  async function loadTiles(){
    const data = await fetchJson("/api/tiles");
    if (!ui.tileSel) return;

    ui.tileSel.innerHTML = '<option value="">— Выбери плитку —</option>';
    tilesMap.clear();

    (data.tiles || []).forEach((tile) => {
      const option = document.createElement("option");
      option.value = String(tile.slug || "");
      option.textContent = `${tile.emoji || ""} ${tile.title} (${tile.slug})`;
      ui.tileSel.appendChild(option);
      tilesMap.set(String(tile.slug || ""), { title: String(tile.title || ""), emoji: String(tile.emoji || "") });
    });

    window.NiceSelect?.refresh?.(ui.tileSel);
  }

  function renderPagination(totalItems){
    if (!ui.pagination) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    if (totalPages <= 1) {
      ui.pagination.innerHTML = "";
      return;
    }

    const start = totalItems ? ((currentPage - 1) * PAGE_SIZE) + 1 : 0;
    const end = Math.min(totalItems, currentPage * PAGE_SIZE);

    ui.pagination.innerHTML = `
      <div class="adminPagination__info">Показано ${start}-${end} из ${totalItems}</div>
      <div class="adminPagination__actions">
        <button class="btn btn--ghost" type="button" data-page-act="prev" ${currentPage <= 1 ? "disabled" : ""}>← Назад</button>
        <div class="adminPagination__page">Страница ${currentPage} / ${totalPages}</div>
        <button class="btn btn--ghost" type="button" data-page-act="next" ${currentPage >= totalPages ? "disabled" : ""}>Вперёд →</button>
      </div>
    `;

    ui.pagination.querySelector('[data-page-act="prev"]')?.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderList();
      }
    });

    ui.pagination.querySelector('[data-page-act="next"]')?.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage += 1;
        renderList();
      }
    });
  }

  function renderList(){
    const total = allProducts.length;
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const pageItems = allProducts.slice(startIndex, startIndex + PAGE_SIZE);

    if (ui.list) {
      ui.list.innerHTML = pageItems.length
        ? pageItems.map(rowCard).join("")
        : '<div class="emptyStateMini">Пока пусто</div>';
    }

    countText(`Товаров: ${total}`);
    if (ui.listMeta) {
      const shownFrom = total ? startIndex + 1 : 0;
      const shownTo = Math.min(total, startIndex + PAGE_SIZE);
      ui.listMeta.textContent = `Показано ${shownFrom}-${shownTo} из ${total}`;
    }

    renderPagination(total);
  }

  async function loadMine(){
    const data = await loadMineWithAccessHandling();
    allProducts = Array.isArray(data.products) ? data.products : [];
    currentPage = 1;
    renderList();
    return allProducts;
  }

  function resetForm(){
    editingId = null;
    if (ui.title) ui.title.value = "";
    if (ui.desc) ui.desc.value = "";
    if (ui.price) ui.price.value = "";
    if (ui.stock) ui.stock.value = "";
    if (ui.tileSel) ui.tileSel.value = "";
    window.NiceSelect?.refresh?.(ui.tileSel);
    if (ui.addBtn) ui.addBtn.textContent = "Добавить";
    renderSpecRows([]);
    setImages([]);
    errLine("");
  }

  function buildPayload(){
    const tile_slug = ui.tileSel?.value || "";
    if (!tile_slug) throw new Error("Выбери плитку");

    const tile = tilesMap.get(String(tile_slug || ""));
    const category = String(tile?.title || "").trim();

    return {
      tile_slug,
      title: String(ui.title?.value || "").trim(),
      description: String(ui.desc?.value || "").trim(),
      price: Number(ui.price?.value || 0),
      stock: Number(ui.stock?.value || 0),
      category: category || tile_slug,
      image_url: currentImages[0] || "",
      images: currentImages,
      specs: normalizeSpecRows(getSpecRowsFromUi({ keepDrafts: true }))
    };
  }

  async function save(){
    let body;
    try {
      body = buildPayload();
    } catch (err) {
      return errLine("❌ " + err.message);
    }

    const btn = ui.addBtn;
    if (btn) btn.disabled = true;

    try {
      if (editingId) {
        await fetchJson("/api/seller/products/" + editingId, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
          body: JSON.stringify(body)
        });
        errLine("Изменения сохранены ✅");
      } else {
        await fetchJson("/api/seller/products", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
          body: JSON.stringify(body)
        });
        errLine("Добавлено ✅");
      }

      resetForm();
      await loadMine();
    } catch (e) {
      errLine(humanizeSellerProductsError(e.message) || (e.message || "unknown"));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function removeProduct(id){
    if (!confirm("Удалить товар #" + id + "?")) return;
    await fetchJson("/api/seller/products/" + id, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token() }
    });
    errLine("Товар удалён ✅");
    await loadMine();
  }

  async function editProduct(id){
    try {
      const data = await fetchJson("/api/products/" + id, {
        headers: { Authorization: "Bearer " + token() }
      });
      const product = data?.product || null;
      if (!product) throw new Error("not_found");

      editingId = id;
      if (ui.title) ui.title.value = product.title || "";
      if (ui.desc) ui.desc.value = product.description || "";
      if (ui.price) ui.price.value = product.price || "";
      if (ui.stock) ui.stock.value = product.stock || 0;
      if (ui.tileSel) ui.tileSel.value = product.tile_slug || "";
      window.NiceSelect?.refresh?.(ui.tileSel);
      if (ui.addBtn) ui.addBtn.textContent = "Сохранить";

      renderSpecRows(product.specs || product.specs_json);
      setImages(getImagesFromProduct(product));
      errLine("Режим редактирования товара #" + id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      errLine(humanizeSellerProductsError(err.message) || ("Ошибка загрузки товара: " + (err.message || "unknown")));
    }
  }

  function bindUploads(){
    ui.pickFilesBtn?.addEventListener("click", () => ui.fileInput?.click());
    ui.fileInput?.addEventListener("change", (e) => addFiles(e.target.files));
    ui.clearImagesBtn?.addEventListener("click", () => setImages([]));

    if (ui.uploadBox) {
      ui.uploadBox.addEventListener("dragover", (e) => {
        e.preventDefault();
        ui.uploadBox.classList.add("drag");
      });
      ui.uploadBox.addEventListener("dragleave", () => ui.uploadBox.classList.remove("drag"));
      ui.uploadBox.addEventListener("drop", (e) => {
        e.preventDefault();
        ui.uploadBox.classList.remove("drag");
        addFiles(e.dataTransfer.files);
      });
    }
  }

  document.addEventListener("click", async (e) => {
    const imageAct = e.target?.dataset?.imageAct;
    if (imageAct) {
      const chip = e.target.closest(".imageChip");
      const idx = Number(chip?.dataset?.idx);
      if (!Number.isFinite(idx)) return;

      if (imageAct === "del") currentImages.splice(idx, 1);
      if (imageAct === "cover" && idx > 0) {
        const [item] = currentImages.splice(idx, 1);
        currentImages.unshift(item);
      }
      if (imageAct === "left" && idx > 0) {
        [currentImages[idx - 1], currentImages[idx]] = [currentImages[idx], currentImages[idx - 1]];
      }
      if (imageAct === "right" && idx < currentImages.length - 1) {
        [currentImages[idx + 1], currentImages[idx]] = [currentImages[idx], currentImages[idx + 1]];
      }
      renderImageGrid();
      return;
    }

    const act = e.target?.dataset?.act;
    if (!act) return;
    const row = e.target.closest(".sellerProductRow");
    const id = row ? Number(row.dataset.id) : 0;
    if (!id) return;

    if (act === "open") location.href = "product.html?id=" + id;
    if (act === "del") {
      try { await removeProduct(id); } catch (err) { errLine("Ошибка: " + err.message); }
    }
    if (act === "edit") {
      await editProduct(id);
    }
  });

  ui.addBtn?.addEventListener("click", save);
  ui.resetBtn?.addEventListener("click", resetForm);

  (async function init(){
    if (!token()) {
      location.href = "login.html";
      return;
    }

    try {
      window.NiceSelect?.initAll?.();
      bindSpecEditor();
      bindUploads();
      renderSpecRows([]);
      renderImageGrid();
      await loadTiles();
      await loadMine();
      errLine("");
    } catch (e) {
      errLine(humanizeSellerProductsError(e.message) || (e.message || "unknown"));
    }
  })();
})();
