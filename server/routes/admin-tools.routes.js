const express = require("express");
const { ok, dbError } = require("../utils/http");

function createAdminToolsRouter({ pool, authRequired, adminRequired }) {
  const router = express.Router();

  router.post("/admin/fix-tile-slugs", authRequired, adminRequired, async (_req, res) => {
    try {
      await pool.query(`
        UPDATE products p
        SET category = c.title
        FROM categories c
        WHERE c.slug = p.tile_slug
      `);

      return ok(res);
    } catch (e) {
      console.error("fix-tile-slugs error:", e);
      return dbError(res, e);
    }
  });

  return router;
}

module.exports = { createAdminToolsRouter };
