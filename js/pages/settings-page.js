(function(){
  const nameEl = document.getElementById("profileName");
  const emailEl = document.getElementById("profileEmail");
  const nickEl = document.getElementById("profileNick");

  const nameInput = document.getElementById("nameInput");
  const nickInput = document.getElementById("nickInput");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const langSelect = document.getElementById("langSelect");
  const saveBtn = document.getElementById("saveProfileBtn");
  const noteEl = document.getElementById("profileNote");

  const avatarBox = document.getElementById("avatarBox");
  const avatarImg = document.getElementById("avatarImg");
  const avatarFallback = document.getElementById("avatarFallback");
  const avatarInput = document.getElementById("avatarInput");

  const logoutBtn = document.getElementById("logoutBtn");
  const adminTile = document.getElementById("adminTile");
  const sellerPanelBtn = document.getElementById("sellerPanelBtn");

  function setText(el, t){ if (el) el.textContent = t ?? ""; }
  function setNote(t){ if (noteEl) noteEl.textContent = t || ""; }

  function getCurrentTheme(){
    const t = (document.documentElement.dataset.theme || localStorage.getItem("market_theme") || "dark").toLowerCase();
    return t === "light" ? "light" : "dark";
  }

  function syncThemeSwitch(){
    if (!themeToggleBtn) return;
    const t = getCurrentTheme();
    themeToggleBtn.setAttribute("aria-checked", t === "light" ? "true" : "false");
  }

  function applyPrefs(user){
    try{
      if (window.MarketUtils){
        if (user?.theme) MarketUtils.applyTheme(user.theme);
        if (user?.lang) MarketUtils.applyLang(user.lang);
      }
    }catch{}
    if (langSelect) langSelect.value = ["ru","kz","en"].includes(user?.lang) ? user.lang : "ru";
    syncThemeSwitch();
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
    if (!res.ok){
      if (res.status === 401) location.href = "login.html";
      return null;
    }
    const data = await res.json().catch(()=>null);
    return data?.user || null;
  }

  async function refreshUI(){
    const u = await loadMe();
    if (!u) return;

    setText(nameEl, u.name || "—");
    setText(emailEl, u.email || "—");
    setText(nickEl, u.nickname || "—");

    if (nameInput) nameInput.value = u.name || "";
    if (nickInput) nickInput.value = u.nickname || "";

    if (adminTile) adminTile.style.display = u.is_admin ? "" : "none";
    if (sellerPanelBtn) sellerPanelBtn.style.display = (u.is_seller || u.is_admin) ? "" : "none";

    setAvatar(u.avatar_url || "");
    applyPrefs(u);
  }

  async function saveProfile(){
    setNote("");
    const payload = {
      name: String(nameInput?.value || "").trim(),
      nickname: String(nickInput?.value || "").trim(),
      lang: String(langSelect?.value || "ru"),
    };

    if (payload.name.length < 2){
      setNote("Имя слишком короткое");
      return;
    }
    if (payload.nickname.length > 32){
      setNote("Ник слишком длинный");
      return;
    }

    if (saveBtn) saveBtn.disabled = true;

    try{
      let res = await MarketAPI.apiFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 404){
        res = await MarketAPI.apiFetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type":"application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok){
        const e = await res.json().catch(()=>({}));
        setNote("Ошибка сохранения: " + (e.error || res.status));
        return;
      }

      const data = await res.json().catch(()=>({}));
      const u = data.user || null;

      if (u){
        setText(nameEl, u.name || "—");
        setText(emailEl, u.email || "—");
        setText(nickEl, u.nickname || "—");
        if (nameInput) nameInput.value = u.name || "";
        if (nickInput) nickInput.value = u.nickname || "";
        setAvatar(u.avatar_url || "");
        applyPrefs(u);
      }

      setNote("Сохранено ✅");
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  async function toggleTheme(){
    setNote("");
    const next = getCurrentTheme() === "dark" ? "light" : "dark";

    try { window.MarketUtils?.applyTheme(next); } catch {}
    syncThemeSwitch();

    try{
      const res = await MarketAPI.apiFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ theme: next })
      });
      if (res.ok){
        const data = await res.json().catch(()=>({}));
        if (data?.user) applyPrefs(data.user);
      }
    } catch {}
  }

  async function uploadAvatar(file){
    setNote("");
    if (!file) return;

    const fd = new FormData();
    fd.append("avatar", file);

    if (saveBtn) saveBtn.disabled = true;

    try{
      const res = await MarketAPI.apiFetch("/api/profile/avatar", {
        method: "POST",
        body: fd
      });

      if (!res.ok){
        const e = await res.json().catch(()=>({}));
        setNote("Ошибка загрузки аватара: " + (e.error || res.status));
        return;
      }

      const data = await res.json().catch(()=>({}));
      setAvatar(data.avatar_url || "");
      setNote("Аватар обновлён ✅");
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  avatarBox?.addEventListener("click", () => avatarInput?.click());
  avatarInput?.addEventListener("change", () => {
    const f = avatarInput.files && avatarInput.files[0];
    if (f) uploadAvatar(f);
    avatarInput.value = "";
  });

  saveBtn?.addEventListener("click", saveProfile);
  themeToggleBtn?.addEventListener("click", toggleTheme);

  logoutBtn?.addEventListener("click", async () => {
    try { await MarketAPI.apiFetch("/api/auth/logout", { method:"POST" }); } catch {}
    MarketAPI.setToken("");
    window.location.href = "index.html";
  });

  refreshUI();
})();