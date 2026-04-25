const express = require("express");

function createCategoriesPublicRouter({ pool, attachImagesToProducts, withProductStats }) {
  const router = express.Router();

  router.get("/categories", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, group_name, section, title, slug, icon_url, emoji, sort_order, is_active
         FROM categories
         WHERE COALESCE(is_active, 1) = 1
         ORDER BY section ASC, sort_order ASC, id ASC`
      );

      res.json(result.rows || []);
    } catch (err) {
      console.error("GET /api/categories error:", err);
      res.status(500).json({ error: "server_error" });
    }
  });

  router.get("/category-groups", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT group_name, COUNT(*)::int AS tiles_count
         FROM categories
         WHERE COALESCE(is_active, 1) = 1
         GROUP BY group_name
         ORDER BY group_name ASC`
      );

      res.json(result.rows || []);
    } catch (err) {
      console.error("GET /api/category-groups error:", err);
      res.status(500).json({ error: "server_error" });
    }
  });

  router.get("/tiles/:slug/products", async (req, res) => {
    try {
      const slug = String(req.params.slug || "").trim().toLowerCase();
      if (!slug) {
        return res.status(400).json({ error: "bad_slug" });
      }

      const result = await pool.query(
        `SELECT p.*
         FROM products p
         WHERE LOWER(COALESCE(p.tile_slug, '')) = $1
         ORDER BY p.id DESC`,
        [slug]
      );

      let rows = result.rows || [];

      try {
        rows = await attachImagesToProducts(rows);
      } catch (e) {
        console.error("tile products attachImages error:", e);
      }

      await withProductStats(rows, null, (out) => res.json(out));
    } catch (err) {
      console.error("GET /api/tiles/:slug/products error:", err);
      res.status(500).json({ error: "server_error" });
    }
  });

  return router;
}

module.exports = { createCategoriesPublicRouter };
