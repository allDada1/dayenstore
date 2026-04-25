const express = require("express");
const { ok, badRequest, notFound, dbError } = require("../utils/http");
const { parseEnum, parseOptionalString, toPositiveInt } = require("../utils/validation");
const { ensureOrderItemSellerStateColumns, sellerCanAccessSale } = require("../services/orders.service");

function createOrderActionsRouter({ pool, authRequired, adminRequired }) {
  const router = express.Router();

  router.post("/orders/:id/pay", authRequired, async (req, res) => {
    const orderId = toPositiveInt(req.params.id);
    const method = parseEnum(req.body?.method, ["card", "kaspi", "balance"], null);

    if (!orderId) return badRequest(res, "bad_id");
    if (!method) return badRequest(res, "bad_method");

    try {
      const isAdmin = !!req.user?.is_admin;
      const qOrder = isAdmin
        ? await pool.query(`SELECT id, user_id, status FROM orders WHERE id = $1`, [orderId])
        : await pool.query(`SELECT id, user_id, status FROM orders WHERE id = $1 AND user_id = $2`, [orderId, req.user.id]);

      const order = qOrder.rows[0];
      if (!order) return notFound(res);

      const cur = String(order.status || "").toLowerCase();
      if (cur === "paid") return ok(res, { already: true });
      if (cur === "cancelled" || cur === "delivered") return badRequest(res, "bad_status");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await ensureOrderItemSellerStateColumns(client);
        const u = await client.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [orderId]);
        if ((u.rowCount || 0) === 0) {
          await client.query("ROLLBACK");
          return notFound(res);
        }

        await client.query(
          `UPDATE order_items
           SET seller_status = 'paid',
               seller_updated_at = NOW()
           WHERE order_id = $1
             AND COALESCE(seller_status, 'pending') = 'pending'`,
          [orderId]
        );

        const note = `Оплата (мок): ${method}`;
        await client.query(
          `INSERT INTO order_status_history(order_id, status, note)
           VALUES ($1, 'paid', $2)`,
          [orderId, note]
        );

        try {
          await client.query(
            `INSERT INTO notifications (user_id, title, body, link)
             VALUES ($1, $2, $3, $4)`,
            [Number(order.user_id), "Оплата принята", `Заказ #${orderId} оплачен (${method}).`, `profile.html`]
          );
        } catch {}

        await client.query("COMMIT");
        return ok(res);
      } catch (e) {
        await client.query("ROLLBACK");
        console.error("ORDER PAY ERROR:", String(e?.message || e));
        return dbError(res, e);
      } finally {
        client.release();
      }
    } catch (e) {
      console.error("ORDER PAY ERROR:", String(e?.message || e));
      return dbError(res, e);
    }
  });

  router.post("/seller/sales/:id/status", authRequired, async (req, res) => {
    const saleId = toPositiveInt(req.params.id);
    const status = parseEnum(req.body?.status, ["pending", "paid", "shipped", "delayed", "delivered", "cancelled"], null);
    const note = parseOptionalString(req.body?.note, { max: 500 }) ?? null;

    if (!saleId) return badRequest(res, "bad_id");
    if (!status) return badRequest(res, "bad_status");
    if (note === null) return badRequest(res, "bad_note");
    if (!req.user?.is_seller) return res.status(403).json({ error: "seller_only", message: "Доступ продавца сейчас отключён." });

    try {
      await ensureOrderItemSellerStateColumns(pool);
      const sale = await sellerCanAccessSale(pool, saleId, req.user.id);
      if (!sale) return notFound(res);

      await pool.query(
        `UPDATE order_items
         SET seller_status = $1,
             seller_note = $2,
             seller_updated_at = NOW()
         WHERE id = $3`,
        [status, note || '', saleId]
      );

      const fullNote = `Изменено продавцом для позиции #${saleId}: ${note || ''}`.trim();
      await pool.query(
        `INSERT INTO order_status_history(order_id, status, note)
         VALUES ($1, $2, $3)`,
        [sale.order_id, status, fullNote]
      );

      try {
        await pool.query(
          `INSERT INTO notifications (user_id, title, body, link)
           VALUES ($1, $2, $3, $4)`,
          [Number(sale.user_id), "Статус товара в заказе обновлён", `Продавец обновил статус товара в заказе #${sale.order_id}: ${status}.`, `orders.html`]
        );
      } catch {}

      return ok(res);
    } catch (e) {
      console.error("SELLER SALE STATUS ERROR:", String(e?.message || e));
      return dbError(res, e);
    }
  });

  router.post("/orders/:id/status", authRequired, adminRequired, async (req, res) => {
    const orderId = toPositiveInt(req.params.id);
    const status = parseEnum(req.body?.status, ["pending", "paid", "shipped", "delayed", "delivered", "cancelled"], null);
    const note = parseOptionalString(req.body?.note, { max: 500 }) ?? null;

    if (!orderId) return badRequest(res, "bad_id");
    if (!status) return badRequest(res, "bad_status");
    if (note === null) return badRequest(res, "bad_note");

    try {
      const u = await pool.query(`UPDATE orders SET status = $1 WHERE id = $2`, [status, orderId]);
      if ((u.rowCount || 0) === 0) return notFound(res);

      await pool.query(
        `INSERT INTO order_status_history(order_id, status, note)
         VALUES ($1, $2, $3)`,
        [orderId, status, note]
      );

      return ok(res);
    } catch (e) {
      console.error("ORDER STATUS ERROR:", String(e?.message || e));
      return dbError(res, e);
    }
  });

  return router;
}

module.exports = { createOrderActionsRouter };
