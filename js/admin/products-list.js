(function initAdminProductsList() {
  const shared = window.AdminProductsShared;
  const { ui, state, setNote, esc, fmtKZT, refreshAll } = shared;
  const { getProductImagesFromRow } = window.AdminProductsUpload;
  const { resolveTileSlug, resetProductForm, fillTileSelect, startEditProduct } = window.AdminProductsForm;

  function fillProductFilterTiles() {
    if (!ui.prodFilterTile) return;
    const prev = String(state.productView.tile || "").trim().toLowerCase();
    const section = String(state.productView.section || "").trim();
    const filteredTiles = state.tiles.filter(t => Number(t.is_active) === 1 && (!section || String(t.section || "") === section));
    ui.prodFilterTile.innerHTML = `<option value="">Все плитки</option>` + filteredTiles.map(t => `<option value="${esc(t.slug)}">${esc(t.title)}</option>`).join("");
    const exists = filteredTiles.some(t => String(t.slug || "").trim().toLowerCase() === prev);
    ui.prodFilterTile.value = exists ? prev : "";
    if (!exists) state.productView.tile = "";
    window.NiceSelect?.refresh?.(ui.prodFilterTile);
  }

  function getFilteredProducts() {
    const q = String(state.productView.search || "").trim().toLowerCase();
    const section = String(state.productView.section || "").trim();
    const tile = String(state.productView.tile || "").trim().toLowerCase();
    const sort = String(state.productView.sort || "new");

    let list = Array.isArray(state.allProducts) ? [...state.allProducts] : [];
    if (q) {
      list = list.filter(p => [p.id, p.title, p.description, p.category, p.section, p.tile_slug]
        .map(v => String(v || ""))
        .join(" ")
        .toLowerCase()
        .includes(q));
    }
    if (section) list = list.filter(p => String(p.section || "").trim() === section);
    if (tile) list = list.filter(p => resolveTileSlug(p.tile_slug || "") === tile);

    list.sort((a, b) => {
      if (sort === "old") return Number(a.id || 0) - Number(b.id || 0);
      if (sort === "title") return String(a.title || "").localeCompare(String(b.title || ""), 'ru');
      if (sort === "price_desc") return Number(b.price || 0) - Number(a.price || 0);
      if (sort === "price_asc") return Number(a.price || 0) - Number(b.price || 0);
      if (sort === "stock_desc") return Number(b.stock || 0) - Number(a.stock || 0);
      return Number(b.id || 0) - Number(a.id || 0);
    });

    return list;
  }

  function renderProductPagination(totalItems) {
    if (!ui.prodPagination) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / state.productView.pageSize));
    state.productView.page = Math.min(Math.max(1, state.productView.page), totalPages);
    const start = totalItems ? ((state.productView.page - 1) * state.productView.pageSize) + 1 : 0;
    const end = Math.min(totalItems, state.productView.page * state.productView.pageSize);

    ui.prodPagination.innerHTML = `
      <div class="adminPagination__info">Показано ${start}-${end} из ${totalItems}</div>
      <div class="adminPagination__actions">
        <button class="btn btn--ghost" type="button" data-page-act="prev" ${state.productView.page <= 1 ? 'disabled' : ''}>← Назад</button>
        <div class="muted" style="align-self:center;">Страница ${state.productView.page} / ${totalPages}</div>
        <button class="btn btn--ghost" type="button" data-page-act="next" ${state.productView.page >= totalPages ? 'disabled' : ''}>Вперёд →</button>
      </div>`;

    ui.prodPagination.querySelector('[data-page-act="prev"]')?.addEventListener('click', () => {
      if (state.productView.page > 1) {
        state.productView.page -= 1;
        applyProductView();
      }
    });
    ui.prodPagination.querySelector('[data-page-act="next"]')?.addEventListener('click', () => {
      if (state.productView.page < totalPages) {
        state.productView.page += 1;
        applyProductView();
      }
    });
  }

  function renderProducts(list) {
    if (!ui.prodList) return;
    ui.prodList.innerHTML = list.length ? list.map(p => `
      <div class="productAdminRow" data-id="${p.id}">
        <div class="productAdminRow__main">
          <div class="productAdminRow__thumb">
            ${getProductImagesFromRow(p)[0] ? `<img src="${esc(getProductImagesFromRow(p)[0])}" alt="" />` : `<span class="muted" style="font-size:12px;">Фото</span>`}
          </div>
          <div class="productAdminRow__name">
            <div class="productAdminRow__title">#${p.id} ${esc(p.title)}</div>
            <div class="productAdminRow__meta">${esc(p.section || "—")} • ♥ ${Number(p.likes || 0)} • ⭐ ${Number(p.rating_avg || 0) ? Number(p.rating_avg).toFixed(1) : "—"} (${Number(p.rating_count || 0)}) • фото: ${getProductImagesFromRow(p).length}</div>
          </div>
        </div>
        <div class="productAdminRow__category">${esc(p.category || "—")}</div>
        <div class="productAdminRow__price">${fmtKZT(p.price)}</div>
        <div class="productAdminRow__stock"><span class="productAdminRow__stockValue">${Number(p.stock || 0)} шт.</span></div>
        <div class="productAdminRow__actions">
          <button class="smallBtn" data-edit type="button">Редактировать</button>
          <button class="smallBtn" data-del type="button">Удалить</button>
        </div>
      </div>`).join("") : `<div class="rowItem"><div class="muted">Ничего не найдено по текущим фильтрам.</div></div>`;

    ui.prodList.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", async () => {
      const id = btn.closest(".productAdminRow, .rowItem")?.dataset?.id;
      if (!id) return;
      const r = await MarketAPI.apiFetch(`/api/products/${id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setNote(ui.prodNote, "Ошибка: " + (d.error || "unknown"));
      setNote(ui.prodNote, "Удалено ✅");
      if (String(state.editingProductId) === String(id)) resetProductForm();
      await refreshAll();
    }));

    ui.prodList.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", async () => {
      const id = Number(btn.closest(".productAdminRow, .rowItem")?.dataset?.id);
      if (!id) return;
      await startEditProduct(id);
      const currentSlug = ui.prodTile?.value;
      fillTileSelect(currentSlug);
    }));
  }

  function applyProductView() {
    const filtered = getFilteredProducts();
    const total = filtered.length;
    const startIndex = (state.productView.page - 1) * state.productView.pageSize;
    const pageItems = filtered.slice(startIndex, startIndex + state.productView.pageSize);
    if (ui.prodMeta) ui.prodMeta.textContent = `Найдено товаров: ${total}`;
    renderProducts(pageItems);
    renderProductPagination(total);
  }

  function bindListEvents() {
    ui.prodSearch?.addEventListener("input", () => {
      state.productView.search = ui.prodSearch.value || "";
      state.productView.page = 1;
      applyProductView();
    });

    ui.prodFilterSection?.addEventListener("change", () => {
      state.productView.section = ui.prodFilterSection.value || "";
      state.productView.page = 1;
      fillProductFilterTiles();
      applyProductView();
    });

    ui.prodFilterTile?.addEventListener("change", () => {
      state.productView.tile = ui.prodFilterTile.value || "";
      state.productView.page = 1;
      applyProductView();
    });

    ui.prodSort?.addEventListener("change", () => {
      state.productView.sort = ui.prodSort.value || "new";
      state.productView.page = 1;
      applyProductView();
    });

    ui.prodFiltersResetBtn?.addEventListener("click", () => {
      state.productView.page = 1;
      state.productView.search = "";
      state.productView.section = "";
      state.productView.tile = "";
      state.productView.sort = "new";

      if (ui.prodSearch) ui.prodSearch.value = "";
      if (ui.prodFilterSection) ui.prodFilterSection.value = "";
      fillProductFilterTiles();
      if (ui.prodSort) ui.prodSort.value = "new";

      window.NiceSelect?.refresh?.(ui.prodFilterSection);
      window.NiceSelect?.refresh?.(ui.prodFilterTile);
      window.NiceSelect?.refresh?.(ui.prodSort);
      applyProductView();
    });
  }

  window.AdminProductsList = {
    fillProductFilterTiles,
    getFilteredProducts,
    renderProductPagination,
    renderProducts,
    applyProductView,
    bindListEvents,
  };
})();
