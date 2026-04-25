(function(){
  function getToken(){
    try {
      if (window.Auth && typeof window.Auth.getToken === 'function') {
        return window.Auth.getToken() || '';
      }
      if (window.MarketAPI && typeof window.MarketAPI.getToken === 'function') {
        return window.MarketAPI.getToken() || '';
      }
    } catch {}

    return localStorage.getItem('market_token') || localStorage.getItem('token') || '';
  }

  async function apiFetchCompat(url, options = {}){
    try {
      if (window.MarketAPI && typeof window.MarketAPI.apiFetch === 'function') {
        return await window.MarketAPI.apiFetch(url, options);
      }
    } catch {}

    const headers = { ...(options.headers || {}) };
    const token = getToken();
    if (token && !headers.Authorization) {
      headers.Authorization = 'Bearer ' + token;
    }

    return fetch(url, { ...options, headers });
  }

  async function fetchJson(url, options = {}){
    const response = await apiFetchCompat(url, options);

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.error || `http_${response.status}`);
    }

    return data;
  }

  window.SellerDashboardApi = {
    getToken,
    fetchJson,
  };
})();
