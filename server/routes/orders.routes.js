const express = require("express");
const {
  createOrder,
  getAccessibleOrder,
  getAccessibleOrderBrief,
  listMyOrders,
  getOrderItems,
  getRepeatOrderItems,
  getOrderHistory,
  listSellerSales,
  summarizeSellerSales,
} = require("../services/orders.service");
const { badRequest, dbError, notFound } = require("../utils/http");
const { toPositiveInt } = require("../utils/validation");

function parseOrderId(value) {
  return toPositiveInt(value);
}

async function loadAccessibleOrderOr404(res, loader, pool, orderId, user) {
  const order = await loader(pool, orderId, user);
  if (!order) {
    notFound(res, "not_found");
    return null;
  }
  return order;
}

function createOrdersRouter({ pool, authRequired }) {
  const router = express.Router();

  router.post("/orders", authRequired, async (req, res) => {
    try {
      const result = await createOrder(pool, req.user.id, req.body);
      if (result?.error) {
        return res.status(result.error.status).json(result.error.body);
      }

      return res.json({ id: result.orderId });
    } catch (error) {
      console.error("POST /api/orders error:", error);
      return dbError(res, error);
    }
  });

  router.get("/orders/my", authRequired, async (req, res) => {
    try {
      const orders = await listMyOrders(pool, req.user.id);
      return res.json(orders);
    } catch (error) {
      console.error("GET /api/orders/my error:", error);
      return dbError(res, error);
    }
  });

  router.get("/orders/:id", authRequired, async (req, res) => {
    try {
      const orderId = parseOrderId(req.params.id);
      if (!orderId) return badRequest(res, "bad_id");

      const order = await loadAccessibleOrderOr404(res, getAccessibleOrder, pool, orderId, req.user);
      if (!order) return;

      const items = await getOrderItems(pool, orderId);
      return res.json({ order, items });
    } catch (error) {
      console.error("GET /api/orders/:id error:", error);
      return dbError(res, error);
    }
  });

  router.post("/orders/:id/repeat", authRequired, async (req, res) => {
    try {
      const orderId = parseOrderId(req.params.id);
      if (!orderId) return badRequest(res, "bad_id");

      const order = await loadAccessibleOrderOr404(res, getAccessibleOrderBrief, pool, orderId, req.user);
      if (!order) return;

      const items = await getRepeatOrderItems(pool, orderId);
      return res.json({ items });
    } catch (error) {
      console.error("POST /api/orders/:id/repeat error:", error);
      return dbError(res, error);
    }
  });


  router.get("/seller/sales", authRequired, async (req, res) => {
    try {
      if (!req.user?.is_seller) return res.status(403).json({ error: "seller_only", message: "Доступ продавца сейчас отключён." });
      const items = await listSellerSales(pool, req.user.id);
      const summary = summarizeSellerSales(items);
      return res.json({ items, summary });
    } catch (error) {
      console.error("GET /api/seller/sales error:", error);
      return dbError(res, error);
    }
  });

  router.get("/orders/:id/history", authRequired, async (req, res) => {
    try {
      const orderId = parseOrderId(req.params.id);
      if (!orderId) return badRequest(res, "bad_id");

      const order = await loadAccessibleOrderOr404(res, getAccessibleOrderBrief, pool, orderId, req.user);
      if (!order) return;

      const items = await getOrderHistory(pool, orderId);
      return res.json({ items });
    } catch (error) {
      console.error("GET /api/orders/:id/history error:", error);
      return dbError(res, error);
    }
  });

  return router;
}

module.exports = { createOrdersRouter };
