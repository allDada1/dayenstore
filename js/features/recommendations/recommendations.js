// Smart Recommendations

(function () {
  const KEY = "market_recently_viewed";
  const LEGACY_KEY = "market_recent_products_ids_v1";

  function readRaw(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }

  function getList() {
    const primary = readRaw(KEY);
    if (Array.isArray(primary) && primary.length) {
      return primary.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    }

    const legacy = readRaw(LEGACY_KEY);
    return Array.isArray(legacy)
      ? legacy.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [];
  }

  function save(list) {
    const normalized = Array.isArray(list)
      ? list.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [];

    localStorage.setItem(KEY, JSON.stringify(normalized));
  }

  function track(id) {
    let list = getList();
    const productId = Number(id);
    if (!Number.isFinite(productId) || productId <= 0) return;

    list = list.filter((value) => value !== productId);
    list.unshift(productId);

    if (list.length > 20) {
      list = list.slice(0, 20);
    }

    save(list);
  }

  function getProducts(products) {
    const viewed = getList();
    const map = new Map((products || []).map((p) => [Number(p.id), p]));
    const result = [];

    for (const id of viewed) {
      const product = map.get(Number(id));
      if (product) result.push(product);
    }

    return result.slice(0, 8);
  }

  window.Recommendations = {
    track,
    getProducts,
    getList,
  };
})();
