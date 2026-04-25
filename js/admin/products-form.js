(function initAdminProductsForm() {
  const shared = window.AdminProductsShared;
  const { ui, state, setNote, esc, refreshAll } = shared;
  const { getProductImagesFromRow, setProductImages } = window.AdminProductsUpload;

  function normalizeSlug(s) {
    return String(s || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "");
  }

  function resolveTileSlug(v) {
    const raw = String(v || "").trim();
    if (!raw) return "";
    const low = raw.toLowerCase();
    const bySlug = state.tiles.find(t => String(t.slug || "").trim().toLowerCase() === low);
    if (bySlug) return String(bySlug.slug || "").trim().toLowerCase();
    const byTitle = state.tiles.find(t => String(t.title || "").trim().toLowerCase() === low);
    if (byTitle) return String(byTitle.slug || "").trim().toLowerCase();
    return normalizeSlug(raw);
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
    const list = parseStoredSpecs(value);
    return list
      .map((item) => `${String(item?.key || "").trim()}: ${String(item?.value || "").trim()}`.trim())
      .filter(Boolean)
      .join("\n");
  }

  function getSpecRowsFromUi(options = {}) {
    const { keepDrafts = false } = options;
    if (!ui.prodSpecsList) return parseSpecsInput(ui.prodSpecs?.value || "");

    const rows = Array.from(ui.prodSpecsList.querySelectorAll(".specRow")).map((row) => ({
      key: row.querySelector('[data-spec-key]')?.value || "",
      value: row.querySelector('[data-spec-value]')?.value || ""
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
        <button class="smallBtn specRow__remove" type="button" data-spec-remove ${source.length === 1 && !(item.key || item.value) ? 'disabled' : ''}>Удалить</button>
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

  function fillTileSelect(selectedSlug) {
    if (!ui.prodTile) return;
    const section = (ui.prodSection?.value || "Игры").trim();
    const prev = (selectedSlug !== undefined) ? selectedSlug : (ui.prodTile.value || "");
    const filtered = state.tiles.filter(t => Number(t.is_active) === 1 && String(t.section || "") === section);
    ui.prodTile.innerHTML = filtered.map(t => `<option value="${esc(t.slug)}">${esc(t.title)}</option>`).join("");
    if (!filtered.length) {
      ui.prodTile.innerHTML = `<option value="">(нет плиток в разделе)</option>`;
      window.NiceSelect?.refresh?.(ui.prodTile);
      return;
    }
    const want = String(prev || "").trim().toLowerCase();
    const exists = filtered.some(t => String(t.slug || "").trim().toLowerCase() === want);
    if (exists) ui.prodTile.value = want;
    window.NiceSelect?.refresh?.(ui.prodTile);
  }

  function resetProductForm() {
    state.editingProductId = null;
    if (ui.prodSaveBtn) ui.prodSaveBtn.textContent = "Добавить";
    if (ui.title) ui.title.value = "";
    if (ui.description) ui.description.value = "";
    if (ui.price) ui.price.value = "";
    if (ui.stock) ui.stock.value = "";
    renderSpecRows([]);
    setProductImages([]);
    setNote(ui.prodNote, "");
  }

  async function startEditProduct(id) {
    const r = await MarketAPI.apiFetch(`/api/products/${id}`);
    const data = await r.json().catch(() => null);
    const p = data?.product || null;
    if (!r.ok || !p) return setNote(ui.prodNote, "Не удалось загрузить товар");

    state.editingProductId = id;
    if (ui.prodSaveBtn) ui.prodSaveBtn.textContent = "Сохранить";
    if (ui.title) ui.title.value = p.title || "";
    if (ui.description) ui.description.value = p.description || "";
    if (ui.price) ui.price.value = p.price ?? "";
    if (ui.stock) ui.stock.value = p.stock ?? "";
    renderSpecRows(p.specs || p.specs_json);
    setProductImages(getProductImagesFromRow(p));

    const pSection = (p.section || "").trim();
    const resolvedSlug = resolveTileSlug((p.tile_slug || "").trim());
    if (pSection && ui.prodSection) ui.prodSection.value = pSection;
    fillTileSelect(resolvedSlug || ui.prodTile?.value);
    if (resolvedSlug && ui.prodTile) ui.prodTile.value = resolvedSlug;

    setNote(ui.prodNote, `Редактирование товара #${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveProduct() {
    if (!ui.prodTile) return;
    const tileSlug = String(ui.prodTile.value || "").trim().toLowerCase();
    if (!tileSlug) {
      return setNote(ui.prodNote, "Сначала создай плитку в этом разделе (или выбери другой раздел).");
    }

    const tileObj = state.tiles.find(t => String(t.slug || "").trim().toLowerCase() === tileSlug);
    const tileTitle = tileObj ? String(tileObj.title || "").trim() : "";
    const specsRows = normalizeSpecRows(getSpecRowsFromUi({ keepDrafts: true }));
    const body = {
      title: (ui.title?.value || "").trim(),
      description: (ui.description?.value || "").trim(),
      price: Number(ui.price?.value),
      stock: Number(ui.stock?.value || 1),
      image_url: state.currentProductImages[0] || "",
      images: state.currentProductImages,
      tile_slug: tileSlug,
      category: tileTitle || (ui.prodSection?.value || "Категория"),
      section: (ui.prodSection?.value || "Игры"),
      specs: specsRows,
      specs_json: JSON.stringify(specsRows)
    };

    if (!body.title || !body.description) return setNote(ui.prodNote, "Заполни название и описание.");
    if (!Number.isFinite(body.price) || body.price <= 0) return setNote(ui.prodNote, "Цена должна быть числом > 0.");

    if (state.editingProductId == null) {
      const r = await MarketAPI.apiFetch("/api/products", { method: "POST", body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setNote(ui.prodNote, "Ошибка: " + (d.error || "unknown"));
      setNote(ui.prodNote, "Добавлено ✅");
    } else {
      const r = await MarketAPI.apiFetch(`/api/products/${state.editingProductId}`, { method: "PATCH", body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setNote(ui.prodNote, "Ошибка: " + (d.error || "unknown"));
      setNote(ui.prodNote, "Сохранено ✅");
    }

    resetProductForm();
    await refreshAll();
  }

  function bindFormEvents() {
    ui.prodSection?.addEventListener("change", () => fillTileSelect());
    ui.prodSaveBtn?.addEventListener("click", saveProduct);
    ui.prodReloadBtn?.addEventListener("click", refreshAll);
    ui.prodCancelBtn?.addEventListener("click", resetProductForm);
  }

  window.AdminProductsForm = {
    normalizeSlug,
    resolveTileSlug,
    normalizeSpecRows,
    parseSpecsInput,
    parseStoredSpecs,
    specsToTextarea,
    getSpecRowsFromUi,
    syncSpecsHidden,
    renderSpecRows,
    addSpecRow,
    bindSpecEditor,
    fillTileSelect,
    resetProductForm,
    startEditProduct,
    saveProduct,
    bindFormEvents,
  };
})();
