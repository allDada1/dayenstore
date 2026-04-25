const express = require("express");
const { ok, badRequest, notFound, dbError } = require("../utils/http");
const { toPositiveInt } = require("../utils/validation");

const REQUESTS_LIST_SQL = `
  SELECT sr.id,
         sr.user_id,
         sr.shop_name,
         sr.shop_slug,
         sr.avatar_url,
         sr.about,
         sr.contacts,
         sr.status,
         sr.admin_comment,
         sr.created_at,
         sr.reviewed_at,
         COALESCE(u.name, '') AS user_name,
         COALESCE(u.email, '') AS email,
         COALESCE(u.is_seller, FALSE) AS is_seller
  FROM seller_requests sr
  LEFT JOIN users u ON u.id = sr.user_id
  ORDER BY sr.created_at DESC
`;

const APPROVE_REQUEST_SQL = `
  UPDATE seller_requests
  SET status = 'approved',
      reviewed_at = NOW()
  WHERE id = $1
    AND status = 'pending'
  RETURNING user_id, shop_slug, shop_name, avatar_url, about
`;

const APPLY_APPROVED_SELLER_SQL = `
  UPDATE users
  SET is_seller = TRUE,
      nickname = $1,
      name = $2,
      avatar_url = COALESCE(NULLIF($3, ''), avatar_url),
      seller_about = COALESCE($4, '')
  WHERE id = $5
`;

const REVOKE_SELLER_SQL = `
  UPDATE users
  SET is_seller = FALSE
  WHERE id = $1
`;

function parseRequestId(value) {
  const id = toPositiveInt(value);
  return id || null;
}

async function withTransaction(pool, handler) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

function createAdminSellerRequestsRouter({ pool, authRequired, adminRequired }) {
  const router = express.Router();

  router.get("/admin/seller-requests", authRequired, adminRequired, async (_req, res) => {
    try {
      const result = await pool.query(REQUESTS_LIST_SQL);
      const items = result.rows || [];
      return ok(res, { items, requests: items });
    } catch (e) {
      console.error("GET seller-requests:", e);
      return dbError(res, e);
    }
  });

  router.post("/admin/seller-requests/:id/approve", authRequired, adminRequired, async (req, res) => {
    const id = parseRequestId(req.params.id);
    if (!id) return badRequest(res, "bad_id");

    try {
      const approved = await withTransaction(pool, async (client) => {
        const requestResult = await client.query(APPROVE_REQUEST_SQL, [id]);
        const requestRow = requestResult.rows[0];

        if (!requestRow) return null;

        await client.query(APPLY_APPROVED_SELLER_SQL, [
          requestRow.shop_slug,
          requestRow.shop_name,
          requestRow.avatar_url,
          requestRow.about,
          requestRow.user_id,
        ]);

        return requestRow;
      });

      if (!approved) return notFound(res, "not_pending");

      return ok(res);
    } catch (e) {
      console.error("APPROVE seller:", e);
      return dbError(res, e);
    }
  });

  router.post("/admin/seller-requests/:id/reject", authRequired, adminRequired, async (req, res) => {
    const id = parseRequestId(req.params.id);
    if (!id) return badRequest(res, "bad_id");

    try {
      const adminComment = String(req.body?.admin_comment || "").trim();
      const result = await pool.query(
        `UPDATE seller_requests
         SET status = 'rejected',
             reviewed_at = NOW(),
             admin_comment = $2
         WHERE id = $1
           AND status = 'pending'`,
        [id, adminComment]
      );

      if ((result.rowCount || 0) === 0) return notFound(res, "not_pending");

      return ok(res);
    } catch (e) {
      console.error("REJECT seller:", e);
      return dbError(res, e);
    }
  });

  router.post("/admin/seller-requests/:id/revoke", authRequired, adminRequired, async (req, res) => {
    const id = parseRequestId(req.params.id);
    if (!id) return badRequest(res, "bad_id");

    try {
      const revoked = await withTransaction(pool, async (client) => {
        const requestResult = await client.query(
          `SELECT id, user_id, status
             FROM seller_requests
            WHERE id = $1
            LIMIT 1`,
          [id]
        );
        const adminComment = String(req.body?.admin_comment || "").trim();
        const requestRow = requestResult.rows[0];
        if (!requestRow) return null;

        await client.query(REVOKE_SELLER_SQL, [requestRow.user_id]);
        await client.query(
          `UPDATE seller_requests
              SET reviewed_at = NOW(),
                  admin_comment = $2
            WHERE id = $1`,
          [id, adminComment || 'Доступ продавца снят администратором']
        );

        return requestRow;
      });

      if (!revoked) return notFound(res, "not_found");

      return ok(res);
    } catch (e) {
      console.error("REVOKE seller:", e);
      return dbError(res, e);
    }
  });


  return router;
}

module.exports = { createAdminSellerRequestsRouter };
