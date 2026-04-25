(function (global) {
  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function toText(value) {
    return String(value ?? "").trim();
  }

  function pickImage(product) {
    const images = Array.isArray(product?.images)
      ? product.images.map((x) => toText(x)).filter(Boolean)
      : [];

    const imageUrl = toText(product?.image_url);
    return {
      image_url: images[0] || imageUrl,
      images,
    };
  }

  function normalizeProduct(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const media = pickImage(source);
    const sellerName =
      toText(source.seller_nickname) ||
      toText(source.seller_name) ||
      toText(source.seller) ||
      toText(source.nickname) ||
      toText(source.name);

    return {
      ...source,
      id: toNumber(source.id, 0),
      title: toText(source.title),
      description: toText(source.description),
      category: toText(source.category),
      section: toText(source.section),
      price: toNumber(source.price, 0),
      stock: toNumber(source.stock, 0),
      likes: toNumber(source.likes, 0),
      rating_avg: toNumber(source.rating_avg, 0),
      rating_count: toNumber(source.rating_count, 0),
      seller_id: toNumber(source.seller_id || source.owner_user_id, 0),
      seller_name: sellerName,
      seller_nickname: toText(source.seller_nickname),
      owner_user_id: toNumber(source.owner_user_id, 0),
      image_url: media.image_url,
      images: media.images,
      is_liked: Boolean(source.is_liked),
      my_rating: source.my_rating ?? null,
    };
  }

  function normalizeList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(normalizeProduct);
  }

  function extractItems(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.products)) return payload.products;
    if (Array.isArray(payload.rows)) return payload.rows;
    if (payload.product && typeof payload.product === "object") return [payload.product];
    return [];
  }

  global.ProductNormalizer = {
    normalizeProduct,
    normalizeList,
    extractItems,
  };
})(window);
