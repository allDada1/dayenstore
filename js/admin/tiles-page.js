
const E = (id) => document.getElementById(id);

const ui = {
  guard: E("admGuardText"),
  catSection: E("catSection"),
  catTitle: E("catTitle"),
  catSlug: E("catSlug"),
  catEmoji: E("catEmoji"),
  catSort: E("catSort"),
  catActive: E("catActive"),
  catAddBtn: E("catAddBtn"),
  catReloadBtn: E("catReloadBtn"),
  catNote: E("catNote"),
  catList: E("catList"),
  catSearch: E("catSearch"),
  catFilterSection: E("catFilterSection"),
  catFilterActive: E("catFilterActive"),
  catSortView: E("catSortView"),
  catMeta: E("catMeta"),
  catPagination: E("catPagination"),
  catFiltersResetBtn: E("catFiltersResetBtn"),
  catUploadBox: E("catUploadBox"),
  catFileInput: E("catFileInput"),
  catPickBtn: E("catPickBtn"),
  catRemoveIconBtn: E("catRemoveIconBtn"),
  catSaveOrderBtn: E("catSaveOrderBtn"),
  catCancelEditBtn: E("catCancelEditBtn"),
  catIconText: E("catIconText"),
  catIconPreview: E("catIconPreview"),
};

let tiles = [];
let currentTileIconUrl = "";
let editingTileId = null;
const tileView = { page: 1, pageSize: 10, search: "", section: "", active: "", sort: "section" };

function setNote(el, t) { if (el) el.textContent = t || ""; }
function esc(s) {
  return String(s || "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function token() { return (window.MarketAPI && MarketAPI.getToken) ? MarketAPI.getToken() : ""; }
function normalizeSlug(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "");
}
function humanUploadError(msg){
  const m = String(msg || "unknown");
  if (m === "no_token") return "no_token (нужно открыть админку через сервер и зайти в аккаунт)";
  if (m === "token_expired") return "token_expired (зайди заново)";
  if (m === "bad_token") return "bad_token (зайди заново)";
  if (m === "admin_only") return "admin_only (этот аккаунт не админ)";
  if (m === "bad_file_type") return "bad_file_type (разрешено: png/jpg/webp/svg/ico/gif)";
  if (m === "file_too_large") return "file_too_large (лимит 10MB)";
  return m;
}
async function ensureAdmin() {
  const r = await MarketAPI.apiFetch("/api/auth/me");
  if (r.status === 401) { location.href = "login.html"; return false; }
  const d = await r.json().catch(() => ({}));
  if (!d.user?.is_admin) {
    if (ui.guard) ui.guard.textContent = "Доступ запрещён: только администратор.";
    return false;
  }
  if (ui.guard) ui.guard.textContent = "Доступ: администратор ✅";
  return true;
}
async function uploadImage(file) {
  const t = token() || localStorage.getItem("market_token") || localStorage.getItem("token") || "";
  if (!t) throw new Error("no_token");
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch("/api/uploads/image?token=" + encodeURIComponent(t), {
    method: "POST",
    headers: { Authorization: "Bearer " + t, "X-Market-Token": t },
    body: fd
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "unknown");
  return data.url;
}
function showTileIcon(url) {
  currentTileIconUrl = url || "";
  if (!ui.catIconPreview || !ui.catIconText) return;
  if (!url) {
    ui.catIconPreview.style.display = "none";
    ui.catIconText.textContent = "Иконка не выбрана";
    return;
  }
  ui.catIconPreview.src = url;
  ui.catIconPreview.style.display = "";
  ui.catIconText.textContent = url;
}
function enterTileEditMode(tile){
  editingTileId = Number(tile.id);
  if (ui.catAddBtn) ui.catAddBtn.textContent = "Сохранить изменения";
  if (ui.catCancelEditBtn) ui.catCancelEditBtn.style.display = "";
  if (ui.catSection) ui.catSection.value = tile.section || "Игры";
  if (ui.catTitle) ui.catTitle.value = tile.title || "";
  if (ui.catSlug) ui.catSlug.value = tile.slug || "";
  if (ui.catEmoji) ui.catEmoji.value = tile.emoji || "";
  if (ui.catSort) ui.catSort.value = String(tile.sort_order ?? 0);
  if (ui.catActive) ui.catActive.value = String(Number(tile.is_active) ? 1 : 0);
  showTileIcon((tile.icon_url||"").trim());
  setNote(ui.catNote, "Режим редактирования: " + (tile.title||""));
}
function exitTileEditMode(){
  editingTileId = null;
  if (ui.catAddBtn) ui.catAddBtn.textContent = "Добавить плитку";
  if (ui.catCancelEditBtn) ui.catCancelEditBtn.style.display = "none";
}
let dragTileId = null;
function bindTileDnD(){
  if (!ui.catList) return;
  const items = Array.from(ui.catList.querySelectorAll(".tileAdminRow"));
  for (const it of items){
    it.addEventListener("dragstart", (e) => {
      dragTileId = it.dataset.id; it.style.opacity = "0.6"; e.dataTransfer.effectAllowed = "move";
    });
    it.addEventListener("dragend", () => { it.style.opacity = ""; dragTileId = null; });
    it.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = ui.catList.querySelector(`.tileAdminRow[data-id="${dragTileId}"]`);
      if (!dragging || dragging === it) return;
      if ((dragging.dataset.section||"") !== (it.dataset.section||"")) return;
      const rect = it.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      if (before) ui.catList.insertBefore(dragging, it);
      else ui.catList.insertBefore(dragging, it.nextSibling);
    });
  }
}
function buildOrdersFromDom(){
  if (!ui.catList) return [];
  const items = Array.from(ui.catList.querySelectorAll(".tileAdminRow"));
  const bySection = new Map();
  for (const it of items){
    const sec = it.dataset.section || "";
    if (!bySection.has(sec)) bySection.set(sec, []);
    bySection.get(sec).push(Number(it.dataset.id));
  }
  const orders = [];
  for (const [sec, ids] of bySection.entries()){
    ids.forEach((id, idx) => orders.push({ id, sort_order: idx * 10 }));
  }
  return orders;
}
async function saveTileOrder(){
  const orders = buildOrdersFromDom();
  if (!orders.length) return;
  const r = await MarketAPI.apiFetch("/api/admin/categories/reorder", { method: "POST", body: JSON.stringify({ orders }) });
  const d = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(d.error || "reorder_failed");
}
function bindTileIconUpload() {
  ui.catPickBtn?.addEventListener("click", () => ui.catFileInput?.click());
  ui.catFileInput?.addEventListener("change", async () => {
    const file = ui.catFileInput.files?.[0];
    if (!file) return;
    try {
      setNote(ui.catNote, "Загрузка иконки…");
      const url = await uploadImage(file);
      showTileIcon(url);
      setNote(ui.catNote, "Иконка загружена ✅");
    } catch (e) {
      console.error(e);
      setNote(ui.catNote, "Ошибка загрузки иконки: " + humanUploadError(e?.message));
    }
  });
  ui.catUploadBox?.addEventListener("dragover", (e) => { e.preventDefault(); ui.catUploadBox.classList.add("drag"); });
  ui.catUploadBox?.addEventListener("dragleave", () => ui.catUploadBox.classList.remove("drag"));
  ui.catUploadBox?.addEventListener("drop", async (e) => {
    e.preventDefault(); ui.catUploadBox.classList.remove("drag");
    const file = e.dataTransfer.files?.[0]; if (!file) return;
    try {
      setNote(ui.catNote, "Загрузка иконки…");
      const url = await uploadImage(file);
      showTileIcon(url);
      setNote(ui.catNote, "Иконка загружена ✅");
    } catch (err) {
      console.error(err);
      setNote(ui.catNote, "Ошибка загрузки иконки: " + humanUploadError(err?.message));
    }
  });
}
async function loadTiles() {
  const r = await MarketAPI.apiFetch("/api/admin/categories");
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "tiles_load_failed");
  return d;
}
function getFilteredTiles() {
  const q = String(tileView.search || "").trim().toLowerCase();
  const section = String(tileView.section || "").trim();
  const active = String(tileView.active || "").trim();
  const sort = String(tileView.sort || "section");
  let list = Array.isArray(tiles) ? [...tiles] : [];
  if (q) list = list.filter(t => [t.id, t.title, t.slug, t.section, t.emoji].map(v => String(v || "")).join(" ").toLowerCase().includes(q));
  if (section) list = list.filter(t => String(t.section || "").trim() === section);
  if (active === "1" || active === "0") list = list.filter(t => String(Number(t.is_active) ? 1 : 0) === active);
  list.sort((a, b) => {
    if (sort === "new") return Number(b.id || 0) - Number(a.id || 0);
    if (sort === "old") return Number(a.id || 0) - Number(b.id || 0);
    if (sort === "title") return String(a.title || "").localeCompare(String(b.title || ""), 'ru');
    if (sort === "sort") return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    const sec = String(a.section || "").localeCompare(String(b.section || ""), 'ru');
    if (sec !== 0) return sec;
    return Number(a.sort_order || 0) - Number(b.sort_order || 0);
  });
  return list;
}
function renderTilePagination(totalItems) {
  if (!ui.catPagination) return;
  const totalPages = Math.max(1, Math.ceil(totalItems / tileView.pageSize));
  tileView.page = Math.min(Math.max(1, tileView.page), totalPages);
  const start = totalItems ? ((tileView.page - 1) * tileView.pageSize) + 1 : 0;
  const end = Math.min(totalItems, tileView.page * tileView.pageSize);
  ui.catPagination.innerHTML = `
  <div class="adminPagination__info">Показано ${start}-${end} из ${totalItems}</div>
  <div class="adminPagination__actions">
    <button class="btn btn--ghost" type="button" data-cat-page-act="prev" ${tileView.page <= 1 ? 'disabled' : ''}>← Назад</button>
    <div class="adminPagination__page">Страница ${tileView.page} / ${totalPages}</div>
    <button class="btn btn--ghost" type="button" data-cat-page-act="next" ${tileView.page >= totalPages ? 'disabled' : ''}>Вперёд →</button>
  </div>`;
  ui.catPagination.querySelector('[data-cat-page-act="prev"]')?.addEventListener('click', () => { if (tileView.page > 1) { tileView.page -= 1; applyTileView(); }});
  ui.catPagination.querySelector('[data-cat-page-act="next"]')?.addEventListener('click', () => { if (tileView.page < totalPages) { tileView.page += 1; applyTileView(); }});
}
function renderTiles(list) {
  if (!ui.catList) return;
  ui.catList.innerHTML = list.length ? list.map(t => {
    const icon = (t.icon_url || "").trim();
    const iconHtml = icon ? `<img src="${esc(icon)}" alt="" />` : `<div style="font-size:20px;">${esc(t.emoji || "🎮")}</div>`;
    return `
      <div class="tileAdminRow" draggable="true" data-id="${t.id}" data-section="${esc(t.section||"")}">
        <div class="tileAdminRow__main">
          <div class="dragHandle tileAdminRow__thumb" title="Перетащи чтобы изменить порядок">${iconHtml}</div>
          <div class="tileAdminRow__name">
            <div class="tileAdminRow__title">${esc(t.title)}</div>
            <div class="tileAdminRow__meta">ID: ${t.id} • ${esc(t.emoji || 'Без emoji')}</div>
          </div>
        </div>
        <div class="tileAdminRow__section">${esc(t.section || '—')}</div>
        <div class="tileAdminRow__slug">${esc(t.slug || '—')}</div>
        <div class="tileAdminRow__sort">${Number(t.sort_order || 0)}</div>
        <div class="tileAdminRow__status"><span class="tileStatusPill ${Number(t.is_active) ? 'is-active' : ''}">${Number(t.is_active) ? 'Активна' : 'Скрыта'}</span></div>
        <div class="tileAdminRow__actions">
          <button class="smallBtn" data-toggle type="button">${Number(t.is_active) ? "Скрыть" : "Показать"}</button>
          <button class="smallBtn" data-edit type="button">Изменить</button>
          <button class="smallBtn" data-del type="button">Удалить</button>
        </div>
      </div>`;
  }).join("") : `<div class="rowItem"><div class="muted">Ничего не найдено по текущим фильтрам.</div></div>`;
  ui.catList.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => {
    const id = Number(btn.closest(".tileAdminRow, .rowItem")?.dataset?.id);
    const tile = tiles.find(x => Number(x.id) === id);
    if (!tile) return;
    enterTileEditMode(tile);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  ui.catList.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", async () => {
    const id = btn.closest(".tileAdminRow, .rowItem")?.dataset?.id;
    if (!id) return;
    const r = await MarketAPI.apiFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setNote(ui.catNote, "Не удалось удалить плитку.");
    setNote(ui.catNote, "Плитка удалена.");
    await refreshAll();
  }));
  ui.catList.querySelectorAll("[data-toggle]").forEach(btn => btn.addEventListener("click", async () => {
    const id = btn.closest(".tileAdminRow, .rowItem")?.dataset?.id;
    if (!id) return;
    const willActive = btn.textContent.includes("Показать");
    const r = await MarketAPI.apiFetch(`/api/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify({ is_active: willActive ? 1 : 0 }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setNote(ui.catNote, "Не удалось изменить статус плитки.");
    setNote(ui.catNote, "Статус плитки обновлён.");
    await refreshAll();
  }));
  bindTileDnD();
}
function applyTileView() {
  const filtered = getFilteredTiles();
  const total = filtered.length;
  const startIndex = (tileView.page - 1) * tileView.pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + tileView.pageSize);
  if (ui.catMeta) ui.catMeta.textContent = `Найдено плиток: ${total}`;
  renderTiles(pageItems);
  renderTilePagination(total);
}
async function checkSlug(slug, excludeId){
  const q = new URLSearchParams({ slug, exclude_id: String(excludeId||0) });
  const r = await MarketAPI.apiFetch("/api/admin/categories/check-slug?" + q.toString());
  const d = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(d.error || "check_failed");
  return !!d.available;
}
async function saveTile() {
  const section = (ui.catSection?.value || "Игры").trim();
  const title = (ui.catTitle?.value || "").trim();
  let slug = (ui.catSlug?.value || "").trim();
  slug = normalizeSlug(slug || title);
  const sort_order = Number(ui.catSort?.value || 0);
  const is_active = (ui.catActive?.value || "1") === "1";
  if (!section || !title || !slug) return setNote(ui.catNote, "Заполни раздел, название и slug.");
  try{
    const ok = await checkSlug(slug, editingTileId || 0);
    if (!ok) return setNote(ui.catNote, "Этот slug уже занят. Придумай другой.");
  }catch{}
  const body = { section, title, slug, icon_url: currentTileIconUrl, emoji: (ui.catEmoji?.value || "").trim(), sort_order, is_active };
  const isEdit = !!editingTileId;
  const url = isEdit ? `/api/admin/categories/${editingTileId}` : "/api/admin/categories";
  const method = isEdit ? "PATCH" : "POST";
  const r = await MarketAPI.apiFetch(url, { method, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return setNote(ui.catNote, "Не удалось сохранить плитку.");
  setNote(ui.catNote, isEdit ? "Изменения сохранены." : "Плитка добавлена.");
  exitTileEditMode();
  await refreshAll();
}
async function refreshAll() {
  try {
    tiles = await loadTiles();
    applyTileView();
  } catch (e) {
    console.error(e);
    setNote(ui.catNote, "Ошибка загрузки данных.");
  }
}
if (ui.catAddBtn) ui.catAddBtn.addEventListener("click", saveTile);
if (ui.catReloadBtn) ui.catReloadBtn.addEventListener("click", refreshAll);
if (ui.catSearch) ui.catSearch.addEventListener("input", () => { tileView.search = ui.catSearch.value || ""; tileView.page = 1; applyTileView(); });
if (ui.catFilterSection) ui.catFilterSection.addEventListener("change", () => { tileView.section = ui.catFilterSection.value || ""; tileView.page = 1; applyTileView(); });
if (ui.catFilterActive) ui.catFilterActive.addEventListener("change", () => { tileView.active = ui.catFilterActive.value || ""; tileView.page = 1; applyTileView(); });
if (ui.catSortView) ui.catSortView.addEventListener("change", () => { tileView.sort = ui.catSortView.value || "section"; tileView.page = 1; applyTileView(); });
if (ui.catFiltersResetBtn) ui.catFiltersResetBtn.addEventListener("click", () => {
  tileView.page = 1; tileView.search = ""; tileView.section = ""; tileView.active = ""; tileView.sort = "section";
  if (ui.catSearch) ui.catSearch.value = "";
  if (ui.catFilterSection) ui.catFilterSection.value = "";
  if (ui.catFilterActive) ui.catFilterActive.value = "";
  if (ui.catSortView) ui.catSortView.value = "section";
  window.NiceSelect?.refresh?.(ui.catFilterSection);
  window.NiceSelect?.refresh?.(ui.catFilterActive);
  window.NiceSelect?.refresh?.(ui.catSortView);
  applyTileView();
});
ui.catCancelEditBtn?.addEventListener("click", () => {
  editingTileId = null;
  if (ui.catTitle) ui.catTitle.value = "";
  if (ui.catSlug) ui.catSlug.value = "";
  if (ui.catEmoji) ui.catEmoji.value = "";
  if (ui.catSort) ui.catSort.value = "";
  if (ui.catActive) ui.catActive.value = "1";
  showTileIcon("");
  if (ui.catAddBtn) ui.catAddBtn.textContent = "Добавить плитку";
  if (ui.catCancelEditBtn) ui.catCancelEditBtn.style.display = "none";
  setNote(ui.catNote, "Отменено");
});
ui.catRemoveIconBtn?.addEventListener("click", () => {
  showTileIcon("");
  if (ui.catFileInput) ui.catFileInput.value = "";
  setNote(ui.catNote, "Иконка удалена (будет показан emoji).");
});
ui.catSlug?.addEventListener("blur", async () => {
  const raw = (ui.catSlug.value || "").trim();
  if (!raw) return;
  const slug = normalizeSlug(raw);
  ui.catSlug.value = slug;
  try{
    const ok = await checkSlug(slug, editingTileId || 0);
    if (!ok) setNote(ui.catNote, "⚠️ Slug занят. Выбери другой.");
  }catch{}
});

(async function () {
  const ok = await ensureAdmin();
  if (!ok) return;
  bindTileIconUpload();
  if (ui.catSaveOrderBtn){
    ui.catSaveOrderBtn.addEventListener("click", async () => {
      try{
        setNote(ui.catNote, "Сохраняю порядок…");
        await saveTileOrder();
        setNote(ui.catNote, "Порядок сохранён ✅");
        await refreshAll();
      }catch(e){
        console.error(e);
        setNote(ui.catNote, "Ошибка сохранения порядка: " + (e?.message || "unknown"));
      }
    });
  }
  window.NiceSelect?.initAll?.();
  window.NiceSelect?.refresh?.(ui.catSection);
  window.NiceSelect?.refresh?.(ui.catActive);
  window.NiceSelect?.refresh?.(ui.catFilterSection);
  window.NiceSelect?.refresh?.(ui.catFilterActive);
  window.NiceSelect?.refresh?.(ui.catSortView);
  showTileIcon("");
  await refreshAll();
})();
