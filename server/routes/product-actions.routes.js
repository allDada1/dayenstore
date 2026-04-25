const express = require("express");
const { ok, badRequest, dbError } = require("../utils/http");
const { toPositiveInt, parseRating } = require("../utils/validation");

function createProductActionsRouter({ pool, authRequired, withProductStats }) {
  const router = express.Router();

  router.post("/products/:id/like", authRequired, async (req, res) => {
    try {
      const productId = toPositiveInt(req.params.id);
      const userId = req.user.id;
      if (!productId) return badRequest(res, "bad_id");

      const existing = await pool.query(
        `SELECT 1
         FROM product_likes
         WHERE user_id = $1 AND product_id = $2
         LIMIT 1`,
        [userId, productId]
      );

      let liked = false;
      if (existing.rows.length) {
        await pool.query(
          `DELETE FROM product_likes
           WHERE user_id = $1 AND product_id = $2`,
          [userId, productId]
        );
      } else {
        await pool.query(
          `INSERT INTO product_likes (user_id, product_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, product_id) DO NOTHING`,
          [userId, productId]
        );
        liked = true;
      }

      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS c
         FROM product_likes
         WHERE product_id = $1`,
        [productId]
      );

      return ok(res, {
        liked,
        likes: Number(countRes.rows[0]?.c || 0),
      });
    } catch (err) {
      console.error("POST /api/products/:id/like error:", err);
      return dbError(res, err);
    }
  });

  router.get("/favorites", authRequired, async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        `SELECT p.*
         FROM products p
         JOIN product_likes l ON l.product_id = p.id
         WHERE l.user_id = $1
         ORDER BY p.id DESC`,
        [userId]
      );

      const rows = result.rows || [];
      return await withProductStats(rows, userId, (out) => ok(res, { items: out }));
    } catch (err) {
      console.error("GET /api/favorites error:", err);
      return dbError(res, err);
    }
  });

  router.post("/products/:id/rate", authRequired, async (req, res) => {
    try {
      const productId = toPositiveInt(req.params.id);
      const userId = req.user.id;
      const rating = parseRating(req.body.rating);

      if (!productId) return badRequest(res, "bad_id");
      if (rating == null) return badRequest(res, "bad_rating");

      await pool.query(
        `INSERT INTO product_ratings (user_id, product_id, rating, updated_at)
         VALUES ($1, $2, $3, NOW()::text)
         ON CONFLICT (user_id, product_id)
         DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()::text`,
        [userId, productId, rating]
      );

      const statsRes = await pool.query(
        `SELECT ROUND(AVG(rating), 2) AS avg,
                COUNT(*)::int AS cnt
         FROM product_ratings
         WHERE product_id = $1`,
        [productId]
      );

      return ok(res, {
        my_rating: rating,
        rating_avg: Number(statsRes.rows[0]?.avg || 0),
        rating_count: Number(statsRes.rows[0]?.cnt || 0),
      });
    } catch (err) {
      console.error("POST /api/products/:id/rate error:", err);
      return dbError(res, err);
    }
  });

  return router;
}

module.exports = { createProductActionsRouter };
