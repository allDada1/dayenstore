const express = require("express");
const { ok, badRequest, notFound, dbError } = require("../utils/http");
const {
  toPositiveInt,
  parseRequiredString,
  parseOptionalString,
  parseSlug,
  parsePriceNumber,
  parseStockNumber,
} = require("../utils/validation");


function parseProductSpecs(raw) {
  if (raw == null) return [];
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

function normalizeSpecsPayload(rawSpecs, rawSpecsJson) {
  if (Array.isArray(rawSpecs)) {
    return rawSpecs
      .map((item) => {
        if (!item) return null;
        const key = parseOptionalString(item?.key || item?.label || item?.name, { max: 120, normalize: true });
        const value = parseOptionalString(item?.value, { max: 500, normalize: true });
        if (!key || !value) return null;
        return { key, value };
      })
      .filter(Boolean)
      .slice(0, 30);
  }

  if (typeof rawSpecsJson === "string" && rawSpecsJson.trim()) {
    try {
      const parsed = JSON.parse(rawSpecsJson);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (!item) return null;
            const key = parseOptionalString(item?.key || item?.label || item?.name, { max: 120, normalize: true });
            const value = parseOptionalString(item?.value, { max: 500, normalize: true });
            if (!key || !value) return null;
            return { key, value };
          })
          .filter(Boolean)
          .slice(0, 30);
      }
    } catch {
      return null;
    }
  }

  return [];
}

function createAdminProductsRouter({
  pool,
  authRequired,
  adminRequired,
  normalizeImagesInput,
  saveProductImages,
}) {
  const router = express.Router();

  router.patch("/products/:id", authRequired, adminRequired, async (req, res) => {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const title = parseRequiredString(req.body.title, { min: 1, max: 200, normalize: true });
      const description = parseRequiredString(req.body.description, { min: 1, max: 20000 });
      const category = parseRequiredString(req.body.category, { min: 1, max: 120, normalize: true });
      const price = parsePriceNumber(req.body.price);
      const stock = parseStockNumber(req.body.stock);
      const tile_slug = req.body.tile_slug ? parseSlug(req.body.tile_slug, { min: 1, max: 100 }) : "";
      const section = parseOptionalString(req.body.section, { max: 120, normalize: true });
      const image_url = parseOptionalString(req.body.image_url, { max: 2000000 });
      const specs_json = parseOptionalString(req.body.specs_json, { max: 20000 });
      const images = normalizeImagesInput(req.body.images);
      const specs = normalizeSpecsPayload(req.body.specs, req.body.specs_json);

      if (!title || !description || !category) return badRequest(res, "missing_fields");
      if (price == null) return badRequest(res, "bad_price");
      if (stock == null) return badRequest(res, "bad_stock");
      if (req.body.tile_slug && tile_slug == null) return badRequest(res, "bad_tile_slug");
      if (section == null) return badRequest(res, "bad_section");
      if (image_url == null) return badRequest(res, "bad_image_url");
      if (specs_json == null) return badRequest(res, "bad_specs_json");
      if (specs == null) return badRequest(res, "bad_specs");

      const coverImage = images[0] || image_url;
      const normalizedSpecsJson = JSON.stringify(specs);

      const result = await pool.query(
        `UPDATE products
         SET title = $1,
             description = $2,
             category = $3,
             price = $4,
             stock = $5,
             image_url = $6,
             tile_slug = $7,
             section = $8,
             specs_json = $9
         WHERE id = $10
         RETURNING id`,
        [title, description, category, price, stock, coverImage, tile_slug || "", section || "Игры", normalizedSpecsJson, id]
      );

      if (!result.rows.length) return notFound(res);

      try {
        await saveProductImages(pool, id, images, coverImage);
      } catch (e) {
        console.error("update product images failed", e);
      }

      return ok(res);
    } catch (err) {
      console.error("PATCH /api/products/:id error:", err);
      return dbError(res, err);
    }
  });

  router.delete("/products/:id", authRequired, adminRequired, async (req, res) => {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const result = await pool.query(
        `DELETE FROM products
         WHERE id = $1
         RETURNING id`,
        [id]
      );

      if (!result.rows.length) return notFound(res);

      await pool.query(
        `DELETE FROM product_images
         WHERE product_id = $1`,
        [id]
      );

      return ok(res);
    } catch (err) {
      console.error("DELETE /api/products/:id error:", err);
      return dbError(res, err);
    }
  });

  return router;
}

module.exports = { createAdminProductsRouter };
