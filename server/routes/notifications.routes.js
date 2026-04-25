const express = require("express");
const { ok, serverError } = require("../utils/http");
const { parseIdArray } = require("../utils/validation");

function createNotificationsRouter({ pool, authRequired }) {
  const router = express.Router();

  router.get("/notifications", authRequired, async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        `SELECT id, title, body, link, is_read, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY id DESC
         LIMIT 50`,
        [userId]
      );

      const rows = result.rows || [];
      const unread = rows.filter((r) => !r.is_read).length;

      return ok(res, {
        unread_count: unread,
        items: rows,
      });
    } catch (err) {
      console.error("GET /api/notifications error:", err);
      return serverError(res);
    }
  });

  router.post("/notifications/read", authRequired, async (req, res) => {
    try {
      const userId = req.user.id;
      const ids = parseIdArray(req.body?.ids);

      if (!ids.length) return ok(res, { updated: 0 });

      const placeholders = ids.map((_, i) => `$${i + 2}`).join(",");
      const result = await pool.query(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE user_id = $1
           AND id IN (${placeholders})`,
        [userId, ...ids]
      );

      return ok(res, { updated: result.rowCount || 0 });
    } catch (err) {
      console.error("POST /api/notifications/read error:", err);
      return serverError(res);
    }
  });

  router.post("/notifications/clear", authRequired, async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        `DELETE FROM notifications
         WHERE user_id = $1
           AND is_read = TRUE`,
        [userId]
      );

      return ok(res, { deleted: result.rowCount || 0 });
    } catch (err) {
      console.error("POST /api/notifications/clear error:", err);
      return serverError(res);
    }
  });

  return router;
}

module.exports = { createNotificationsRouter };
