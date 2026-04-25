const express = require("express");

function createTilesRouter({ pool }) {
  const router = express.Router();

  router.get("/tiles", async (_req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, title, slug, emoji, icon_url, section, sort_order
         FROM categories
         WHERE COALESCE(is_active, 1) = 1
         ORDER BY section ASC, sort_order ASC, id ASC`
      );

      return res.json({ tiles: r.rows || [] });
    } catch (err) {
      console.error("GET /api/tiles error:", err);
      return res.status(500).json({ error: "server_error" });
    }
  });

  return router;
}

module.exports = { createTilesRouter };
