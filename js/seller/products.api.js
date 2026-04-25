(function(){
  function token(){
    try { if (window.MarketAPI && typeof MarketAPI.getToken === "function") return MarketAPI.getToken() || ""; } catch {}
    return localStorage.getItem("market_token") || localStorage.getItem("token") || "";
  }

  async function apiFetchCompat(url, opt = {}){
    try {
      if (window.MarketAPI && typeof MarketAPI.apiFetch === "function") return await MarketAPI.apiFetch(url, opt);
    } catch {}
    const headers = { ...(opt.headers || {}) };
    const t = token();
    if (t && !headers.Authorization) headers.Authorization = "Bearer " + t;
    return fetch(url, { ...opt, headers });
  }

  async function fetchJson(url, opt = {}){
    const response = await apiFetchCompat(url, opt);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || ("http_" + response.status));
    return data;
  }

  function errLine(text){
    const el = document.getElementById("errLine");
    if (el) el.textContent = text || "";
  }

  function countText(text){
    const el = document.getElementById("countText");
    if (el) el.textContent = text || "";
  }

  window.SellerProductsAPI = { token, apiFetchCompat, fetchJson, errLine, countText };
})();
