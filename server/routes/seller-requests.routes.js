const express = require("express");
const { ok, badRequest, conflict, serverError } = require("../utils/http");
const { parseRequiredString, parseOptionalString, parseSlug } = require("../utils/validation");

function createSellerRequestsRouter({ pool, authRequired }) {
  const router = express.Router();

  router.get("/seller/request-status", authRequired, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, user_id, shop_name, shop_slug, avatar_url, about, contacts, status, admin_comment, created_at, reviewed_at
           FROM seller_requests
          WHERE user_id = $1
          ORDER BY id DESC
          LIMIT 1`,
        [req.user.id]
      );
      return ok(res, { request: r.rows[0] || null });
    } catch (err) {
      console.error("GET /api/seller/request-status error:", err);
      return serverError(res);
    }
  });

  router.post("/seller/apply", authRequired, async (req, res) => {
    try {
      const rawShopSlug = req.body?.shop_slug || req.body?.username;
      const rawShopName = req.body?.shop_name;
      const shop_slug = parseSlug(rawShopSlug, { min: 3, max: 40 });
      const shop_name = parseRequiredString(rawShopName, { min: 2, max: 120, normalize: true });
      const avatar_url = parseOptionalString(req.body?.avatar_url, { max: 2000000 });
      const contacts = parseOptionalString(req.body?.contacts, { max: 500, normalize: true });
      const about = parseOptionalString(req.body?.about, { max: 2000, normalize: true });

      if (!String(rawShopSlug || '').trim() || !String(rawShopName || '').trim()) return badRequest(res, "missing_fields");
      if (!shop_slug) return badRequest(res, "bad_shop_slug");
      if (!shop_name) return badRequest(res, "bad_shop_name");
      if (avatar_url == null) return badRequest(res, "bad_avatar_url");
      if (contacts == null) return badRequest(res, "bad_contacts");
      if (about == null) return badRequest(res, "bad_about");

      const currentSeller = await pool.query(
      `SELECT id
        FROM users
        WHERE id = $1
        AND is_seller = TRUE
        LIMIT 1`,
         [req.user.id]
      );
      if (currentSeller.rows.length) return conflict(res, "already_seller");

      const pending = await pool.query(
        `SELECT id
           FROM seller_requests
          WHERE user_id = $1
            AND status = 'pending'
          LIMIT 1`,
        [req.user.id]
      );
      if (pending.rows.length) return conflict(res, "request_already_pending");

      const slugTakenByUser = await pool.query(
        `SELECT id
           FROM users
          WHERE LOWER(COALESCE(nickname, '')) = LOWER($1)
          LIMIT 1`,
        [shop_slug]
      );
      if (slugTakenByUser.rows.length) return conflict(res, "shop_slug_taken");

      const slugTakenByRequest = await pool.query(
        `SELECT id
           FROM seller_requests
          WHERE LOWER(shop_slug) = LOWER($1)
            AND status IN ('pending', 'approved')
          LIMIT 1`,
        [shop_slug]
      );
      if (slugTakenByRequest.rows.length) return conflict(res, "shop_slug_taken");

      await pool.query(
        `INSERT INTO seller_requests
         (user_id, shop_name, shop_slug, avatar_url, about, contacts, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [req.user.id, shop_name, shop_slug, avatar_url, about, contacts]
      );

      return ok(res, { message: "Заявка отправлена. Ожидайте решения администратора." });
    } catch (err) {
      console.error("POST /api/seller/apply error:", err);
      return serverError(res);
    }
  });

  return router;
}

module.exports = { createSellerRequestsRouter };
