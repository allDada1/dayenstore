// js/core/auth.js
(function (global) {
  const TOKEN_KEY = "market_token";
  const SESSION_KEY = "market_session";
  const ME_TTL_MS = 15000;

  let meCache = null;
  let meCacheAt = 0;

  function emitAuthChanged() {
    try {
      global.dispatchEvent(
        new CustomEvent("market:auth-changed", {
          detail: {
            token: getToken(),
            session: getSession(),
          },
        })
      );
    } catch {}
  }

  function getToken() {
    try {
      return (
        global.localStorage.getItem(TOKEN_KEY) ||
        global.localStorage.getItem("token") ||
        global.localStorage.getItem("auth_token") ||
        global.localStorage.getItem("authToken") ||
        global.localStorage.getItem("marketToken") ||
        global.localStorage.getItem("admin_token") ||
        ""
      );
    } catch {
      return "";
    }
  }

  function setToken(token) {
    try {
      if (!token) global.localStorage.removeItem(TOKEN_KEY);
      else global.localStorage.setItem(TOKEN_KEY, token);

      meCache = null;
      meCacheAt = 0;
      emitAuthChanged();
    } catch {}
  }

  function clearToken() {
    setToken("");
  }

  function getSession() {
    try {
      const raw = global.localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setSession(user) {
    try {
      if (!user || typeof user !== "object") {
        global.localStorage.removeItem(SESSION_KEY);
      } else {
        global.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      }
      emitAuthChanged();
    } catch {}
  }

  function clearSession() {
    try {
      global.localStorage.removeItem(SESSION_KEY);
      emitAuthChanged();
    } catch {}
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function logout() {
    try {
      if (global.google?.accounts?.id) {
        try { global.google.accounts.id.disableAutoSelect(); } catch {}
        try { global.google.accounts.id.cancel(); } catch {}
      }
      global.localStorage.removeItem(TOKEN_KEY);
      global.localStorage.removeItem(SESSION_KEY);
      meCache = null;
      meCacheAt = 0;
      emitAuthChanged();
    } catch {}
  }

  async function getMe({ force = false } = {}) {
    const now = Date.now();

    if (!force && meCache && now - meCacheAt < ME_TTL_MS) {
      return meCache;
    }

    const token = getToken();
    if (!token) {
      meCache = null;
      meCacheAt = now;
      return null;
    }

    try {
      const res = await fetch("/api/auth/me", {
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      if (!res.ok) {
        if (res.status === 401) logout();
        meCache = null;
        meCacheAt = now;
        return null;
      }

      const data = await res.json().catch(() => ({}));
      const user = data?.user || null;

      if (user) setSession(user);

      meCache = user;
      meCacheAt = now;
      return user;
    } catch {
      meCache = null;
      meCacheAt = now;
      return null;
    }
  }

  global.Auth = {
    TOKEN_KEY,
    SESSION_KEY,
    getToken,
    setToken,
    clearToken,
    getSession,
    setSession,
    clearSession,
    isLoggedIn,
    logout,
    getMe,
  };
})(window);