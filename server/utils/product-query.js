function normalizeSort(sortRaw, dirRaw) {
  const sort = String(sortRaw || "new").trim().toLowerCase();
  const dir = String(dirRaw || "desc").trim().toLowerCase() === "asc" ? "asc" : "desc";

  if (["price", "likes", "rating", "new"].includes(sort)) {
    return { sort, dir };
  }

  return { sort: "new", dir: "desc" };
}

function sortProducts(list, sortRaw, dirRaw) {
  const { sort, dir } = normalizeSort(sortRaw, dirRaw);
  const mult = dir === "asc" ? 1 : -1;
  const arr = Array.isArray(list) ? list.slice() : [];

  if (sort === "price") {
    arr.sort((a, b) => (Number(a.price || 0) - Number(b.price || 0)) * mult);
    return arr;
  }

  if (sort === "likes") {
    arr.sort((a, b) => (Number(a.likes || 0) - Number(b.likes || 0)) * mult);
    return arr;
  }

  if (sort === "rating") {
    arr.sort((a, b) => {
      const ra = Number(a.rating_avg || 0);
      const rb = Number(b.rating_avg || 0);
      if (ra !== rb) return (ra - rb) * mult;

      const ca = Number(a.rating_count || 0);
      const cb = Number(b.rating_count || 0);
      if (ca !== cb) return (ca - cb) * mult;

      return (Number(a.id || 0) - Number(b.id || 0)) * -1;
    });
    return arr;
  }

  arr.sort((a, b) => (Number(a.id || 0) - Number(b.id || 0)) * -1 * mult);
  return arr;
}

function toPositiveInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

module.exports = {
  normalizeSort,
  sortProducts,
  toPositiveInt,
};
