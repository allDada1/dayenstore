const express = require("express");
const { ok, created, badRequest, notFound, serverError } = require("../utils/http");
const {
  toPositiveInt,
  parseRequiredString,
  parseOptionalString,
  parseSlug,
  parsePriceNumber,
  parseStockNumber,
} = require("../utils/validation");

const SELLER_ACCESS_SQL = `
  SELECT status,
         COALESCE(admin_comment, '') AS admin_comment,
         reviewed_at
  FROM seller_requests
  WHERE user_id = $1
  ORDER BY reviewed_at DESC NULLS LAST, id DESC
  LIMIT 1`;

async function buildSellerAccessError(pool, userId) {
  const result = await pool.query(SELLER_ACCESS_SQL, [userId]);
  const row = result.rows[0] || null;
  return {
    error: "seller_only",
    message: "Доступ продавца сейчас отключён.",
    admin_comment: row?.admin_comment || "",
    seller_status: row?.status || "inactive",
    reviewed_at: row?.reviewed_at || null,
  };
}

function parseProductSpecs(raw, { allowMissing = false } = {}) {
  if (raw == null) return allowMissing ? null : [];
  if (!Array.isArray(raw)) return null;

  const items = raw
    .map((item) => {
      const key = parseOptionalString(item?.key, { max: 120, normalize: true });
      const value = parseOptionalString(item?.value, { max: 500, normalize: true });
      if (key == null || value == null) return null;
      if (!key || !value) return null;
      return { key, value };
    })
    .filter(Boolean)
    .slice(0, 30);

  return items;
}

const LIST_MY_PRODUCTS_SQL = `
  SELECT *
  FROM products
  WHERE owner_user_id = $1
  ORDER BY id DESC`;

const INSERT_PRODUCT_SQL = `
  INSERT INTO products
    (title, description, price, stock, category, image_url, tile_slug, section, owner_user_id, specs_json)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  RETURNING id`;

const UPDATE_PRODUCT_SQL = `
  UPDATE products
  SET title = $1,
      description = $2,
      category = $3,
      price = $4,
      stock = $5,
      image_url = $6,
      tile_slug = $7,
      specs_json = COALESCE($8, specs_json)
  WHERE id = $9
    AND owner_user_id = $10
  RETURNING id`;

const DELETE_PRODUCT_IMAGES_SQL = `
  DELETE FROM product_images
  WHERE product_id = $1`;

const DELETE_PRODUCT_SQL = `
  DELETE FROM products
  WHERE id = $1
    AND owner_user_id = $2
  RETURNING id`;

async function ensureSeller(pool, req, res) {
  if (!req.user || !req.user.is_seller) {
    const payload = await buildSellerAccessError(pool, req.user?.id || 0);
    res.status(403).json(payload);
    return false;
  }
  return true;
}

function parseSellerProductBody(body, normalizeImagesInput) {
  const title = parseRequiredString(body?.title, { min: 1, max: 200, normalize: true });
  const description = parseRequiredString(body?.description, { min: 1, max: 10000, normalize: true });
  const tile_slug = parseSlug(body?.tile_slug, { min: 1, max: 120 });
  const category = parseRequiredString(body?.category || body?.tile_slug, { min: 1, max: 120, normalize: true });
  const price = parsePriceNumber(body?.price);
  const stock = parseStockNumber(body?.stock, 0);
  const image_url = parseOptionalString(body?.image_url, { max: 2000000 });
  const images = normalizeImagesInput(body?.images);
  const coverImage = images[0] || image_url;
  const specs = parseProductSpecs(body?.specs, { allowMissing: true });

  if (!title || !description || !category || !tile_slug) return { error: "missing_fields" };
  if (price == null) return { error: "bad_price" };
  if (stock == null) return { error: "bad_stock" };
  if (image_url == null) return { error: "bad_image_url" };
  if (specs == null) return { error: "bad_specs" };

  return {
    title,
    description,
    category,
    tile_slug,
    price,
    stock,
    image_url,
    images,
    coverImage,
    specs,
  };
}

async function persistProductImages({ pool, saveProductImages, productId, images, coverImage, label }) {
  try {
    await saveProductImages(pool, productId, images, coverImage);
  } catch (err) {
    console.error(label, err);
  }
}

function createSellerProductsRouter({
  pool,
  authRequired,
  normalizeImagesInput,
  saveProductImages,
}) {
  const router = express.Router();

  router.get("/seller/products", authRequired, async (req, res) => {
    if (!(await ensureSeller(pool, req, res))) return;

    try {
      const result = await pool.query(LIST_MY_PRODUCTS_SQL, [req.user.id]);
      return ok(res, { products: result.rows || [] });
    } catch (err) {
      console.error("GET /api/seller/products error:", err);
      return serverError(res);
    }
  });

  router.post("/seller/products", authRequired, async (req, res) => {
    if (!(await ensureSeller(pool, req, res))) return;

    try {
      const payload = parseSellerProductBody(req.body, normalizeImagesInput);
      if (payload.error) return badRequest(res, payload.error);

      const result = await pool.query(INSERT_PRODUCT_SQL, [
        payload.title,
        payload.description,
        payload.price,
        payload.stock,
        payload.category,
        payload.coverImage,
        payload.tile_slug,
        "Игры",
        req.user.id,
        JSON.stringify(payload.specs || []),
      ]);

      const newId = result.rows[0].id;

      await persistProductImages({
        pool,
        saveProductImages,
        productId: newId,
        images: payload.images,
        coverImage: payload.coverImage,
        label: "save seller product images failed",
      });

      return created(res, { id: newId });
    } catch (err) {
      console.error("POST /api/seller/products error:", err);
      return serverError(res);
    }
  });

  router.put("/seller/products/:id", authRequired, async (req, res) => {
    if (!(await ensureSeller(pool, req, res))) return;

    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const payload = parseSellerProductBody(req.body, normalizeImagesInput);
      if (payload.error) return badRequest(res, payload.error);

      const result = await pool.query(UPDATE_PRODUCT_SQL, [
        payload.title,
        payload.description,
        payload.category,
        payload.price,
        payload.stock,
        payload.coverImage,
        payload.tile_slug,
        JSON.stringify(payload.specs || []),
        id,
        req.user.id,
      ]);

      if (!result.rows.length) return notFound(res);

      await persistProductImages({
        pool,
        saveProductImages,
        productId: id,
        images: payload.images,
        coverImage: payload.coverImage,
        label: "update seller product images failed",
      });

      return ok(res);
    } catch (err) {
      console.error("PUT /api/seller/products/:id error:", err);
      return serverError(res);
    }
  });

  router.delete("/seller/products/:id", authRequired, async (req, res) => {
    if (!(await ensureSeller(pool, req, res))) return;

    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      await pool.query(DELETE_PRODUCT_IMAGES_SQL, [id]);
      const result = await pool.query(DELETE_PRODUCT_SQL, [id, req.user.id]);

      if (!result.rows.length) return notFound(res);
      return ok(res);
    } catch (err) {
      console.error("DELETE /api/seller/products/:id error:", err);
      return serverError(res);
    }
  });

  return router;
}

module.exports = { createSellerProductsRouter };
