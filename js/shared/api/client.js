// js/api.js
// Единый публичный API wrapper для frontend.

const MarketAPI = {
  getToken() {
    try {
      if (window.MarketUtils && typeof window.MarketUtils.getToken === "function") {
        return window.MarketUtils.getToken() || "";
      }
    } catch {}

    try {
      if (window.Auth && typeof window.Auth.getToken === "function") {
        return window.Auth.getToken() || "";
      }
    } catch {}

    return (
      localStorage.getItem("market_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("marketToken") ||
      localStorage.getItem("admin_token") ||
      ""
    );
  },

  setToken(token) {
    try {
      if (window.MarketUtils && typeof window.MarketUtils.setToken === "function") {
        window.MarketUtils.setToken(token || "");
        return;
      }
    } catch {}

    try {
      if (window.Auth && typeof window.Auth.setToken === "function") {
        window.Auth.setToken(token || "");
        return;
      }
    } catch {}

    if (!token) localStorage.removeItem("market_token");
    else localStorage.setItem("market_token", String(token));
  },

  async apiFetch(url, options = {}) {
    const opt = { ...options };
    opt.headers = opt.headers ? { ...opt.headers } : {};

    const hasBody = opt.body !== undefined && opt.body !== null;
    const isFormData = typeof FormData !== "undefined" && opt.body instanceof FormData;

    if (hasBody && !isFormData && typeof opt.body !== "string") {
      opt.body = JSON.stringify(opt.body);
    }

    if (hasBody && !isFormData && !opt.headers["Content-Type"]) {
      opt.headers["Content-Type"] = "application/json";
    }

    const token = this.getToken();
    if (token && !opt.headers.Authorization) {
      opt.headers.Authorization = "Bearer " + token;
    }

    return fetch(url, opt);
  },

  async json(url, options = {}) {
    const res = await this.apiFetch(url, options);
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

    if (!res.ok) {
      const err = new Error((data && data.error) ? data.error : ("HTTP " + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  },

  get(url, options = {}) {
    return this.json(url, { ...options, method: "GET" });
  },

  post(url, body, options = {}) {
    return this.json(url, { ...options, method: "POST", body });
  },

  put(url, body, options = {}) {
    return this.json(url, { ...options, method: "PUT", body });
  },

  del(url, options = {}) {
    return this.json(url, { ...options, method: "DELETE" });
  },
};

if (typeof window !== "undefined") {
  window.MarketAPI = MarketAPI;
}
