(function(){
  const nameEl = document.getElementById("profileName");
  const emailEl = document.getElementById("profileEmail");
  const nickEl = document.getElementById("profileNick");
  const roleEl = document.getElementById("profileRole");
  const statusEl = document.getElementById("profileStatus");

  const avatarBox = document.getElementById("avatarBox");
  const avatarImg = document.getElementById("avatarImg");
  const avatarFallback = document.getElementById("avatarFallback");
  const avatarInput = document.getElementById("avatarInput");

  const logoutBtn = document.getElementById("logoutBtn");
  const adminTile = document.getElementById("adminTile");

  function setText(el, t){ if (el) el.textContent = t ?? ""; }

  function applyPrefs(user){
    try{
      if (window.MarketUtils){
        if (user?.theme) MarketUtils.applyTheme(user.theme);
        if (user?.lang) MarketUtils.applyLang(user.lang);
      }
    }catch{}
  }

  function setAvatar(url){
    const u = String(url || "").trim();
    if (u){
      if (avatarImg){
        avatarImg.src = u;
        avatarImg.hidden = false;
      }
      if (avatarFallback) avatarFallback.hidden = true;
    } else {
      if (avatarImg) avatarImg.hidden = true;
      if (avatarFallback) avatarFallback.hidden = false;
    }
  }

  async function loadMe(){
    const res = await MarketAPI.apiFetch("/api/auth/me");
    if (!res.ok) return null;
    const data = await res.json().catch(()=>null);
    return data?.user || null;
  }

  async function loadSellerRequestStatus(){
    try{
      const res = await MarketAPI.apiFetch("/api/seller/request-status");
      if (!res.ok) return null;
      const data = await res.json().catch(()=>null);
      return data?.request || null;
    } catch { return null; }
  }

  function resolveRole(user){
  if (user?.is_admin) return { text: "Администратор", cls: "roleBadge roleBadge--admin" };
  if (user?.is_seller) return { text: "Продавец", cls: "roleBadge roleBadge--seller" };
  return { text: "Покупатель", cls: "roleBadge roleBadge--user" };
  }

  function resolveStatus(user, request){
    if (user?.is_admin) return "Полный доступ к управлению";
    if (user?.is_seller) return "Магазин активен";

    const status = String(request?.status || "").toLowerCase();
    if (status === "pending") return "Заявка продавца на рассмотрении";
    if (status === "rejected") return "Можно отправить заявку повторно";
    return "Аккаунт активен";
  }

  function updateSellerTiles(user, request){
    const sellerPanelBtn = document.getElementById("sellerPanelBtn");
    const sellerProductsBtn = document.getElementById("sellerProductsBtn");
    const sellerApplyBtn = document.getElementById("sellerApplyBtn");
    const sellerPendingBtn = document.getElementById("sellerPendingBtn");
    const sellerRejectedBtn = document.getElementById("sellerRejectedBtn");
    const sellerPendingSub = document.getElementById("sellerPendingSub");
    const sellerRejectedSub = document.getElementById("sellerRejectedSub");

    const setHidden = (el, hidden) => {
      if (!el) return;
      el.style.display = hidden ? "none" : "";
    };

    const isSeller = !!user?.is_seller || !!user?.is_admin;

    setHidden(sellerPanelBtn, !isSeller);
    setHidden(sellerProductsBtn, !isSeller);

    if (isSeller){
      setHidden(sellerApplyBtn, true);
      setHidden(sellerPendingBtn, true);
      setHidden(sellerRejectedBtn, true);
      return;
    }

    const status = String(request?.status || "").toLowerCase();

    if (status === "pending"){
      if (sellerPendingSub){
        sellerPendingSub.textContent = request?.created_at
          ? `Заявка отправлена ${String(request.created_at).slice(0,16).replace("T", " ")}`
          : "Администратор ещё проверяет данные продавца";
      }
      setHidden(sellerApplyBtn, true);
      setHidden(sellerPendingBtn, false);
      setHidden(sellerRejectedBtn, true);
      return;
    }

    if (status === "rejected"){
      const reason = String(request?.admin_comment || "").trim();
      if (sellerRejectedSub){
        sellerRejectedSub.textContent = reason
          ? `Причина отказа: ${reason}`
          : "Открой страницу продавца, чтобы посмотреть статус и отправить повторно";
      }
      setHidden(sellerApplyBtn, true);
      setHidden(sellerPendingBtn, true);
      setHidden(sellerRejectedBtn, false);
      return;
    }

    setHidden(sellerApplyBtn, false);
    setHidden(sellerPendingBtn, true);
    setHidden(sellerRejectedBtn, true);
  }

  async function refreshUI(){
    const u = await loadMe();
    if (!u) return;
    const request = await loadSellerRequestStatus();

    setText(nameEl, u.name || "—");
    setText(emailEl, u.email || "—");
    setText(nickEl, u.nickname || "—");

    const role = resolveRole(u);
    if (roleEl){
      roleEl.textContent = role.text;
      roleEl.className = role.cls;
    }
    setText(statusEl, resolveStatus(u, request));

    if (adminTile) adminTile.style.display = u.is_admin ? "" : "none";

    updateSellerTiles(u, request);
    setAvatar(u.avatar_url || "");
    applyPrefs(u);
  }

  async function uploadAvatar(file){
    if (!file) return;
    const fd = new FormData();
    fd.append("avatar", file);

    try{
      const res = await MarketAPI.apiFetch("/api/profile/avatar", {
        method: "POST",
        body: fd
      });

      if (!res.ok) return;

      const data = await res.json().catch(()=>({}));
      setAvatar(data.avatar_url || "");
    } catch {}
  }

  avatarBox?.addEventListener("click", () => avatarInput?.click());
  avatarInput?.addEventListener("change", () => {
    const f = avatarInput.files && avatarInput.files[0];
    if (f) uploadAvatar(f);
    avatarInput.value = "";
  });

  logoutBtn?.addEventListener("click", async () => {
    try { await MarketAPI.apiFetch("/api/auth/logout", { method:"POST" }); } catch {}
    MarketAPI.setToken("");
    window.location.href = "index.html";
  });

  refreshUI();
})();

