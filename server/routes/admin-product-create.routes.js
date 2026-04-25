const express = require("express");

function normalizeSpecsPayload(rawSpecs, rawSpecsJson) {
  if (Array.isArray(rawSpecs)) {
    return rawSpecs
      .map((item) => {
        if (!item) return null;
        const key = String(item.key || item.label || item.name || "").trim();
        const value = String(item.value || "").trim();
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
            const key = String(item.key || item.label || item.name || "").trim();
            const value = String(item.value || "").trim();
            if (!key || !value) return null;
            return { key, value };
          })
          .filter(Boolean)
          .slice(0, 30);
      }
    } catch {
      // ignore invalid JSON and fall back to empty array
    }
  }

  return [];
}

function createAdminProductCreateRouter({
  pool,
  authRequired,
  adminRequired,
  normalizeImagesInput,
  saveProductImages,
}) {
  const router = express.Router();

  router.post("/products", authRequired, adminRequired, async (req, res) => {
    try {
      const { title, description, category, price, stock, image_url } = req.body;
      const tile_slug = String(req.body.tile_slug || "").trim().toLowerCase();
      const section = String(req.body.section || "Игры").trim();
      const images = normalizeImagesInput(req.body.images);

      if (!title || !description || !category) {
        return res.status(400).json({ error: "missing_fields" });
      }

      const p = Number(price);
      const s = Number(stock ?? 10);

      if (!Number.isFinite(p) || p <= 0) {
        return res.status(400).json({ error: "bad_price" });
      }

      if (!Number.isFinite(s) || s < 0) {
        return res.status(400).json({ error: "bad_stock" });
      }

      const coverImage = images[0] || String(image_url || "").trim();
      const specsRows = normalizeSpecsPayload(req.body.specs, req.body.specs_json);
      const specsJson = JSON.stringify(specsRows);

      const result = await pool.query(
        `INSERT INTO products
         (title, description, price, stock, category, image_url, tile_slug, section, owner_user_id, specs_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [title, description, p, s, category, coverImage, tile_slug, section, req.user.id, specsJson]
      );

      const newId = result.rows[0].id;

      try {
        await saveProductImages(pool, newId, images, coverImage);
      } catch (e) {
        console.error("save product images failed", e);
      }

      try {
        const sellerDisplay =
          req.user.nickname && String(req.user.nickname).trim()
            ? String(req.user.nickname).trim()
            : String(req.user.name || "Продавец");

        const nTitle = `Новый товар у продавца ${sellerDisplay}`;
        const nBody = String(title || "");
        const nLink = `product.html?id=${newId}`;

        await pool.query(
          `INSERT INTO notifications (user_id, title, body, link)
           SELECT follower_user_id, $2, $3, $4
           FROM seller_follows
           WHERE seller_user_id = $1`,
          [req.user.id, nTitle, nBody, nLink]
        );
      } catch (e) {
        console.error("create notifications for followers failed", e);
      }

      return res.json({ id: newId });
    } catch (err) {
      console.error("POST /api/products error:", err);
      return res.status(500).json({
        error: "db_error",
        details: err?.message || String(err),
      });
    }
  });

  return router;
}

module.exports = { createAdminProductCreateRouter };
