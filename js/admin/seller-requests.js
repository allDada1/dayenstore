(function(){
  const E = (id) => document.getElementById(id);
  const ui = {
    guard: E("reqGuardText"),
    note: E("reqNote"),
    search: E("reqSearch"),
    status: E("reqStatusFilter"),
    sort: E("reqSort"),
    reset: E("reqResetBtn"),
    list: E("reqList"),
    meta: E("reqMeta"),
    pagination: E("reqPagination"),
  };
  const { apiFetchCompat, fetchJson, escapeHtml, formatDate } = window.AdminSellerRequestsAPI || {};

  let all = [];
  let page = 1;
  const PAGE_SIZE = 10;

  function setNote(text){
    if (ui.note) ui.note.textContent = text || "";
  }

  function refreshSelects(){
    window.NiceSelect?.refresh?.(ui.status);
    window.NiceSelect?.refresh?.(ui.sort);
  }

  async function ensureAdmin(){
    const response = await apiFetchCompat("/api/auth/me");
    if (response.status === 401) {
      location.href = "login.html";
      return false;
    }
    const data = await response.json().catch(() => ({}));
    if (!data.user?.is_admin) {
      if (ui.guard) ui.guard.textContent = "Доступ запрещён: только администратор.";
      return false;
    }
    if (ui.guard) ui.guard.textContent = "Доступ: администратор ✅";
    return true;
  }

  function statusBadge(status){
    const map = {
      pending: ["На рассмотрении", "is-pending"],
      approved: ["Одобрена", "is-approved"],
      rejected: ["Отклонена", "is-rejected"],
    };
    const [label, cls] = map[String(status || "").toLowerCase()] || [status || "—", ""];
    return `<span class="statusBadge ${cls}">${escapeHtml(label)}</span>`;
  }

  function sellerAccessBadge(row){
    const isApproved = String(row?.status || "") === "approved";
    if (!isApproved) return "";

    const isSeller = !!row?.is_seller;
    const label = isSeller ? "Доступ активен" : "Доступ снят";
    const cls = isSeller ? "is-active" : "is-revoked";
    return `<span class="sellerAccessBadge ${cls}">${escapeHtml(label)}</span>`;
  }

  function getAdminCommentLabel(row){
    const isApproved = String(row?.status || "") === "approved";
    const isSeller = !!row?.is_seller;
    if (isApproved && !isSeller) return "Причина снятия доступа";
    if (String(row?.status || "") === "rejected") return "Причина отказа";
    return "Комментарий админа";
  }

  function renderRowCard(row){
    const canModerate = String(row.status) === "pending";
    const canRevoke = String(row.status) === "approved" && !!row.is_seller;
    const shopHref = `seller.html?id=${Number(row.user_id) || 0}`;
    const contacts = String(row.contacts || "").trim();
    const adminComment = String(row.admin_comment || "").trim();
    const about = String(row.about || "").trim();

    return `
      <article class="adminReqCard adminReqCard--seller">
        <div class="adminReqCard__head">
          <div class="adminReqCard__headMain">
            <div class="adminReqCard__title">#${Number(row.id) || 0} · ${escapeHtml(row.shop_name || "Без названия")}</div>
            <div class="adminReqCard__sub">slug: ${escapeHtml(row.shop_slug || "—")} · пользователь: ${escapeHtml(row.user_name || "—")} · email: ${escapeHtml(row.email || "—")}</div>
          </div>
          <div class="adminReqCard__badges">
            ${statusBadge(row.status)}
            ${sellerAccessBadge(row)}
          </div>
        </div>

        <div class="adminReqGrid">
          <div class="adminReqMeta"><span>Контакты</span><b>${escapeHtml(contacts || "—")}</b></div>
          <div class="adminReqMeta"><span>Создана</span><b>${escapeHtml(formatDate(row.created_at))}</b></div>
          <div class="adminReqMeta"><span>Проверена</span><b>${escapeHtml(formatDate(row.reviewed_at))}</b></div>
          <div class="adminReqMeta"><span>${escapeHtml(getAdminCommentLabel(row))}</span><b>${escapeHtml(adminComment || "—")}</b></div>
        </div>

        <div class="adminReqAboutWrap">
          <div class="adminReqAboutTitle">О магазине</div>
          <div class="adminReqAbout">${escapeHtml(about || "Описание не заполнено")}</div>
        </div>

        <div class="adminReqActions">
          ${canModerate ? `
            <button class="btn btn--primary" type="button" data-approve="${row.id}">Одобрить</button>
            <button class="btn" type="button" data-toggle-reject="${row.id}">Отклонить</button>
          ` : ""}
          ${canRevoke ? `<button class="btn" type="button" data-toggle-revoke="${row.id}">Снять доступ</button>` : ""}
          <a class="btn btn--ghost" href="${escapeHtml(shopHref)}" target="_blank" rel="noopener noreferrer">Открыть магазин</a>
          <button class="btn btn--ghost" type="button" data-copy-slug="${escapeHtml(row.shop_slug || "")}">Копировать slug</button>
        </div>

        ${canModerate ? `
          <div class="adminReqReject" id="rejectWrap-${row.id}" hidden>
            <textarea class="textarea" id="rejectNote-${row.id}" rows="3" placeholder="Причина отказа (необязательно)"></textarea>
            <div class="row">
              <button class="btn" type="button" data-reject="${row.id}">Подтвердить отказ</button>
            </div>
          </div>
        ` : ""}

        ${canRevoke ? `
          <div class="adminReqReject" id="revokeWrap-${row.id}" hidden>
            <textarea class="textarea" id="revokeNote-${row.id}" rows="3" placeholder="Комментарий администратора при снятии доступа"></textarea>
            <div class="row">
              <button class="btn" type="button" data-revoke="${row.id}">Подтвердить снятие доступа</button>
            </div>
          </div>
        ` : ""}
      </article>
    `;
  }

  function applyFilters(){
    const q = String(ui.search?.value || "").trim().toLowerCase();
    const status = String(ui.status?.value || "all");
    const sort = String(ui.sort?.value || "new");

    const rows = all.filter((row) => {
      if (status !== "all" && String(row.status) !== status) return false;
      if (!q) return true;
      const hay = [row.id, row.shop_name, row.shop_slug, row.user_name, row.email, row.contacts, row.about, row.admin_comment].join(" ").toLowerCase();
      return hay.includes(q);
    });

    rows.sort((a, b) => {
      if (sort === "old") return Number(a.id || 0) - Number(b.id || 0);
      if (sort === "shop") return String(a.shop_name || "").localeCompare(String(b.shop_name || ""), "ru");
      if (sort === "status") return String(a.status || "").localeCompare(String(b.status || ""), "ru");
      return Number(b.id || 0) - Number(a.id || 0);
    });

    return rows;
  }

  function renderPagination(totalItems){
    if (!ui.pagination) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    page = Math.min(Math.max(1, page), totalPages);

    if (totalPages <= 1) {
      ui.pagination.innerHTML = "";
      return;
    }

    const start = totalItems ? ((page - 1) * PAGE_SIZE) + 1 : 0;
    const end = Math.min(totalItems, page * PAGE_SIZE);

    ui.pagination.innerHTML = `
      <div class="adminPagination__info">Показано ${start}-${end} из ${totalItems}</div>
      <div class="adminPagination__actions">
        <button class="btn btn--ghost" type="button" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>← Назад</button>
        <div class="adminPagination__page">Страница ${page} / ${totalPages}</div>
        <button class="btn btn--ghost" type="button" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>Вперёд →</button>
      </div>
    `;
  }

  function render(){
    const rows = applyFilters();
    const total = rows.length;
    const start = (page - 1) * PAGE_SIZE;
    const visible = rows.slice(start, start + PAGE_SIZE);

    if (ui.meta) ui.meta.textContent = `Заявок: ${total}`;
    if (ui.list) ui.list.innerHTML = visible.length ? visible.map(renderRowCard).join("") : `<div class="emptyStateMini">Заявки не найдены</div>`;
    renderPagination(total);
  }

  async function load(){
    setNote("Загрузка заявок…");
    const data = await fetchJson("/api/admin/seller-requests");
    all = Array.isArray(data.requests) ? data.requests : (Array.isArray(data.items) ? data.items : []);
    page = 1;
    render();
    setNote(all.length ? "Список заявок обновлён ✅" : "Пока заявок нет");
  }

  async function approveRequest(id){
    setNote(`Одобрение заявки #${id}…`);
    await fetchJson(`/api/admin/seller-requests/${id}/approve`, { method: "POST" });
    await load();
    setNote(`Заявка #${id} одобрена ✅`);
  }

  async function rejectRequest(id){
    const note = document.getElementById(`rejectNote-${id}`)?.value || "";
    setNote(`Отклонение заявки #${id}…`);
    await fetchJson(`/api/admin/seller-requests/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_comment: note }),
    });
    await load();
    setNote(`Заявка #${id} отклонена ✅`);
  }

  async function revokeSeller(id){
    const note = document.getElementById(`revokeNote-${id}`)?.value || "";
    setNote(`Снятие доступа продавца у заявки #${id}…`);
    await fetchJson(`/api/admin/seller-requests/${id}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_comment: note }),
    });
    await load();
    setNote(`Доступ продавца по заявке #${id} снят ✅`);
  }

  document.addEventListener("click", async (e) => {
    const pageBtn = e.target?.dataset?.page;
    if (pageBtn) {
      page = Math.max(1, Number(pageBtn) || 1);
      render();
      return;
    }

    const copySlug = e.target?.dataset?.copySlug;
    if (typeof copySlug === "string") {
      try {
        await navigator.clipboard.writeText(copySlug);
        setNote("Slug скопирован ✅");
      } catch {
        setNote("Не удалось скопировать slug");
      }
      return;
    }

    const toggleReject = e.target?.dataset?.toggleReject;
    if (toggleReject) {
      const wrap = document.getElementById(`rejectWrap-${toggleReject}`);
      if (wrap) wrap.hidden = !wrap.hidden;
      return;
    }

    const toggleRevoke = e.target?.dataset?.toggleRevoke;
    if (toggleRevoke) {
      const wrap = document.getElementById(`revokeWrap-${toggleRevoke}`);
      if (wrap) wrap.hidden = !wrap.hidden;
      return;
    }

    const approveId = e.target?.dataset?.approve;
    if (approveId) {
      try {
        await approveRequest(approveId);
      } catch (err) {
        setNote("Ошибка: " + err.message);
      }
      return;
    }

    const rejectId = e.target?.dataset?.reject;
    if (rejectId) {
      try {
        await rejectRequest(rejectId);
      } catch (err) {
        setNote("Ошибка: " + err.message);
      }
      return;
    }

    const revokeId = e.target?.dataset?.revoke;
    if (revokeId) {
      try {
        await revokeSeller(revokeId);
      } catch (err) {
        setNote("Ошибка: " + err.message);
      }
    }
  });

  ui.search?.addEventListener("input", () => { page = 1; render(); });
  ui.search?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      ui.search.value = "";
      page = 1;
      render();
    }
  });
  ui.status?.addEventListener("change", () => { page = 1; render(); });
  ui.sort?.addEventListener("change", () => { page = 1; render(); });
  ui.reset?.addEventListener("click", () => {
    if (ui.search) ui.search.value = "";
    if (ui.status) ui.status.value = "all";
    if (ui.sort) ui.sort.value = "new";
    page = 1;
    refreshSelects();
    render();
    setNote("Фильтры сброшены");
  });

  (async function init(){
    try {
      window.NiceSelect?.initAll?.();
      refreshSelects();
      const ok = await ensureAdmin();
      if (!ok) return;
      await load();
    } catch (err) {
      setNote("");
      if (ui.guard) ui.guard.textContent = "Ошибка: " + (err.message || "unknown");
    }
  })();
})();
