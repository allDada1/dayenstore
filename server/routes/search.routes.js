const express = require("express");

function createSearchRouter({ pool }) {
  const router = express.Router();

  router.get("/search/suggest", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();

      if (!q || q.length < 2) {
        return res.json({ products: [], categories: [] });
      }

      const productsRes = await pool.query(
        `
        SELECT id, title, category
        FROM products
        WHERE title ILIKE $1
           OR description ILIKE $1
           OR category ILIKE $1
        ORDER BY id DESC
        LIMIT 8
        `,
        [`%${q}%`]
      );

      const categoriesRes = await pool.query(
        `
        SELECT DISTINCT category
        FROM products
        WHERE category IS NOT NULL
          AND category <> ''
          AND category ILIKE $1
        ORDER BY category ASC
        LIMIT 8
        `,
        [`%${q}%`]
      );

      return res.json({
        products: productsRes.rows || [],
        categories: (categoriesRes.rows || []).map((x) => x.category).filter(Boolean),
      });
    } catch (err) {
      console.error("GET /api/search/suggest error:", err);
      return res.status(500).json({ error: "server_error" });
    }
  });

  return router;
}

module.exports = { createSearchRouter };
