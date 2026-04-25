const express = require("express");
const { ok, created, badRequest, forbidden, serverError } = require("../utils/http");
const { toPositiveInt, parseRating, parseOptionalString } = require("../utils/validation");

function createReviewsRouter({ pool, authRequired }) {
  const router = express.Router();

  async function getReviewPermission(productId, userId) {
    if (!productId || !userId) {
      return { can_review: false, reason: "auth_required", already_reviewed: false };
    }

    const existing = await pool.query(
      `SELECT id FROM reviews WHERE user_id = $1 AND product_id = $2 LIMIT 1`,
      [userId, productId]
    );

    if (existing.rows.length) {
      return { can_review: false, reason: "already_reviewed", already_reviewed: true };
    }

    const delivered = await pool.query(
      `SELECT o.id
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
        WHERE o.user_id = $1
          AND oi.product_id = $2
          AND o.status = 'delivered'
        ORDER BY o.id DESC
        LIMIT 1`,
      [userId, productId]
    );

    if (!delivered.rows.length) {
      return { can_review: false, reason: "not_purchased", already_reviewed: false };
    }

    return {
      can_review: true,
      reason: null,
      already_reviewed: false,
      order_id: Number(delivered.rows[0].id || 0),
    };
  }

  router.get("/:productId", async (req, res) => {
    try {
      const productId = toPositiveInt(req.params.productId);
      if (!productId) return badRequest(res, "bad_product_id");

      const result = await pool.query(
        `SELECT r.*, u.name
           FROM reviews r
           LEFT JOIN users u ON u.id = r.user_id
          WHERE r.product_id = $1
          ORDER BY r.created_at DESC`,
        [productId]
      );

      return ok(res, { items: result.rows || [] });
    } catch (e) {
      console.error("GET /api/reviews/:productId error:", e);
      return serverError(res);
    }
  });

  router.get("/:productId/can-review", authRequired, async (req, res) => {
    try {
      const productId = toPositiveInt(req.params.productId);
      if (!productId) return badRequest(res, "bad_product_id");

      const info = await getReviewPermission(productId, toPositiveInt(req.user.id));
      return ok(res, info);
    } catch (e) {
      console.error("GET /api/reviews/:productId/can-review error:", e);
      return serverError(res);
    }
  });

  router.post("/", authRequired, async (req, res) => {
    try {
      const userId = toPositiveInt(req.user.id);
      const product_id = toPositiveInt(req.body.product_id);
      const rating = parseRating(req.body.rating);
      const comment = parseOptionalString(req.body.comment, { max: 5000, normalize: true });

      if (!product_id) return badRequest(res, "bad_product_id");
      if (rating == null) return badRequest(res, "bad_rating");
      if (comment == null) return badRequest(res, "bad_comment");

      const permission = await getReviewPermission(product_id, userId);
      if (!permission.can_review) {
        return forbidden(res, permission.reason || "not_allowed");
      }

      const result = await pool.query(
        `INSERT INTO reviews (user_id, product_id, rating, comment)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, product_id, rating, comment]
      );

      return created(res, { review: result.rows[0] });
    } catch (e) {
      if (e.code === "23505") {
        return badRequest(res, "already_reviewed");
      }

      console.error("POST /api/reviews error:", e);
      return serverError(res);
    }
  });

  return router;
}

module.exports = { createReviewsRouter };
