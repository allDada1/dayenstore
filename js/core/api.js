// js/core/api.js
// Совместимый слой над MarketAPI, чтобы не было второго независимого API-ядра.

(function (global) {
  function ensureMarketAPI() {
    if (!global.MarketAPI) {
      throw new Error("MarketAPI is not loaded");
    }
    return global.MarketAPI;
  }

  async function request(method, url, body, opts) {
    const api = ensureMarketAPI();
    const options = { ...(opts || {}), method };

    if (body !== undefined) {
      options.body = body;
    }

    return api.json(url, options);
  }

  global.api = {
    get(url, opts) {
      return request("GET", url, undefined, opts);
    },
    post(url, body, opts) {
      return request("POST", url, body, opts);
    },
    put(url, body, opts) {
      return request("PUT", url, body, opts);
    },
    del(url, opts) {
      return request("DELETE", url, undefined, opts);
    },
    request,
  };
})(window);