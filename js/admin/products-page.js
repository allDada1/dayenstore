const E = (id) => document.getElementById(id);

(function initAdminProductsNamespace() {
  const ui = {
    guard: E("admGuardText"),
    prodSection: E("prodSection"),
    prodTile: E("prodTile"),
    title: E("title"),
    description: E("description"),
    price: E("price"),
    stock: E("stock"),
    prodSpecs: E("prodSpecs"),
    prodSpecsEditor: E("prodSpecsEditor"),
    prodSpecsList: E("prodSpecsList"),
    addSpecRowBtn: E("addSpecRowBtn"),
    prodSaveBtn: E("prodSaveBtn"),
    prodReloadBtn: E("prodReloadBtn"),
    prodCancelBtn: E("prodCancelBtn"),
    prodNote: E("prodNote"),
    prodList: E("prodList"),
    prodSearch: E("prodSearch"),
    prodFilterSection: E("prodFilterSection"),
    prodFilterTile: E("prodFilterTile"),
    prodSort: E("prodSort"),
    prodMeta: E("prodMeta"),
    prodPagination: E("prodPagination"),
    prodFiltersResetBtn: E("prodFiltersResetBtn"),
    uploadBox: E("uploadBox"),
    fileInput: E("fileInput"),
    pickFilesBtn: E("pickFilesBtn"),
    clearImagesBtn: E("clearImagesBtn"),
    imageGrid: E("imageGrid"),
    imageUrlText: E("imageUrlText"),
  };

  const state = {
    tiles: [],
    editingProductId: null,
    currentProductImages: [],
    allProducts: [],
    productView: { page: 1, pageSize: 10, search: "", section: "", tile: "", sort: "new" }
  };

  function setNote(el, t) { if (el) el.textContent = t || ""; }
  function esc(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function fmtKZT(v) {
    const s = String(Math.round(Number(v) || 0));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";
  }
  function token() {
    return (window.MarketAPI && MarketAPI.getToken) ? MarketAPI.getToken() : "";
  }
  async function ensureAdmin() {
    const r = await MarketAPI.apiFetch("/api/auth/me");
    if (r.status === 401) {
      location.href = "login.html";
      return false;
    }
    const d = await r.json().catch(() => ({}));
    if (!d.user?.is_admin) {
      if (ui.guard) ui.guard.textContent = "Доступ запрещён: только администратор.";
      return false;
    }
    if (ui.guard) ui.guard.textContent = "Доступ: администратор ✅";
    return true;
  }

  async function loadTiles() {
    const r = await MarketAPI.apiFetch("/api/admin/categories");
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "tiles_load_failed");
    return Array.isArray(d) ? d : [];
  }

  async function loadProducts() {
    const r = await MarketAPI.apiFetch("/api/products");
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("products_load_failed");
    return Array.isArray(d?.items) ? d.items : [];
  }

  async function refreshAll() {
    try {
      state.tiles = await loadTiles();
      window.AdminProductsForm.fillTileSelect();
      state.allProducts = await loadProducts();
      window.AdminProductsList.fillProductFilterTiles();
      window.AdminProductsList.applyProductView();
    } catch (e) {
      console.error(e);
      setNote(ui.prodNote, "Ошибка загрузки данных.");
    }
  }

  window.AdminProductsShared = {
    ui,
    state,
    setNote,
    esc,
    fmtKZT,
    token,
    ensureAdmin,
    loadTiles,
    loadProducts,
    refreshAll,
  };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`script_load_failed:${src}`));
      document.head.appendChild(s);
    });
  }

  (async function bootstrap() {
    try {
      await loadScript('js/admin/products-upload.js');
      await loadScript('js/admin/products-form.js');
      await loadScript('js/admin/products-list.js');

      const ok = await ensureAdmin();
      if (!ok) return;

      window.AdminProductsUpload.bindProductUpload();
      window.AdminProductsForm.bindSpecEditor();
      window.AdminProductsForm.bindFormEvents();
      window.AdminProductsList.bindListEvents();
      window.AdminProductsForm.renderSpecRows([]);

      window.NiceSelect?.initAll?.();
      window.NiceSelect?.refresh?.(ui.prodSection);
      window.NiceSelect?.refresh?.(ui.prodTile);
      window.NiceSelect?.refresh?.(ui.prodFilterSection);
      window.NiceSelect?.refresh?.(ui.prodFilterTile);
      window.NiceSelect?.refresh?.(ui.prodSort);

      window.AdminProductsUpload.setProductImages([]);
      await refreshAll();
    } catch (error) {
      console.error(error);
      setNote(ui.prodNote, 'Ошибка инициализации admin-products.');
    }
  })();
})();
