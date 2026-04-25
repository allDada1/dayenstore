function selectAccessibleOrderSql(columns = "*") {
  return {
    admin: `SELECT ${columns} FROM orders WHERE id = $1`,
    user: `SELECT ${columns} FROM orders WHERE id = $1 AND user_id = $2`,
  };
}

async function queryAccessibleOrder(pool, orderId, user, columns = "*") {
  const sql = selectAccessibleOrderSql(columns);
  const isAdmin = !!user?.is_admin;
  const result = isAdmin
    ? await pool.query(sql.admin, [orderId])
    : await pool.query(sql.user, [orderId, user.id]);

  return result.rows[0] || null;
}

async function getAccessibleOrder(pool, orderId, user) {
  return queryAccessibleOrder(pool, orderId, user, "*");
}

async function getAccessibleOrderBrief(pool, orderId, user) {
  return queryAccessibleOrder(pool, orderId, user, "id, user_id, status");
}

async function ensureOrderItemSellerStateColumns(poolOrClient) {
  await poolOrClient.query(`
    ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS seller_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS seller_note TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS seller_updated_at TIMESTAMP DEFAULT NOW()
  `);
}


function aggregateSellerStatuses(rows, fallbackStatus = 'created') {
  const items = Array.isArray(rows) ? rows : [];
  const normalized = items
    .map((row) => String(row?.seller_status || '').toLowerCase().trim())
    .filter(Boolean);

  if (!normalized.length) return String(fallbackStatus || 'created').toLowerCase();

  const uniq = [...new Set(normalized)];
  if (uniq.length === 1) return uniq[0];
  return 'mixed';
}

async function listMyOrders(pool, userId) {
  await ensureOrderItemSellerStateColumns(pool);

  const result = await pool.query(
    `SELECT *
     FROM orders
     WHERE user_id = $1
     ORDER BY id DESC`,
    [userId]
  );

  const orders = result.rows || [];
  if (!orders.length) return orders;

  const orderIds = orders.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
  const itemsResult = await pool.query(
    `SELECT order_id, COALESCE(seller_status, 'pending') AS seller_status
     FROM order_items
     WHERE order_id = ANY($1::int[])`,
    [orderIds]
  );

  const byOrder = new Map();
  for (const row of itemsResult.rows || []) {
    const key = Number(row.order_id);
    if (!byOrder.has(key)) byOrder.set(key, []);
    byOrder.get(key).push(row);
  }

  return orders.map((order) => {
    const displayStatus = aggregateSellerStatuses(byOrder.get(Number(order.id)) || [], order.status || 'created');
    return {
      ...order,
      display_status: displayStatus,
    };
  });
}

async function getOrderItems(pool, orderId) {
  await ensureOrderItemSellerStateColumns(pool);

  const result = await pool.query(
    `SELECT
       oi.*, 
       COALESCE(oi.seller_status, 'pending') AS seller_status,
       COALESCE(oi.seller_note, '') AS seller_note,
       oi.seller_updated_at,
       COALESCE(p.owner_user_id, 0) AS seller_id,
       COALESCE(u.name, '') AS seller_name,
       COALESCE(u.email, '') AS seller_email,
       COALESCE(p.image_url, '') AS image_url
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN users u ON u.id = p.owner_user_id
     WHERE oi.order_id = $1
     ORDER BY oi.id ASC`,
    [orderId]
  );

  return result.rows || [];
}

async function getRepeatOrderItems(pool, orderId) {
  const result = await pool.query(
    `SELECT oi.product_id,
            oi.qty,
            COALESCE(p.stock, 0) AS available_stock
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1
     ORDER BY oi.id ASC`,
    [orderId]
  );

  return result.rows || [];
}

async function getOrderHistory(pool, orderId) {
  const result = await pool.query(
    `SELECT status, note, created_at
     FROM order_status_history
     WHERE order_id = $1
     ORDER BY id ASC`,
    [orderId]
  );

  return result.rows || [];
}

function normalizeOrderInput(body) {
  return {
    items: Array.isArray(body?.items) ? body.items : [],
    delivery: body?.delivery && typeof body.delivery === "object" ? body.delivery : {},
    comment: String(body?.comment || "").trim(),
  };
}

function getUniqueProductIds(items) {
  return [...new Set(items.map((item) => Number(item?.product_id)).filter((id) => Number.isFinite(id) && id > 0))];
}

async function loadProductsForOrder(pool, productIds) {
  if (!productIds.length) return [];

  const placeholders = productIds.map((_, i) => `$${i + 1}`).join(",");
  const result = await pool.query(
    `SELECT id, title, price, stock
     FROM products
     WHERE id IN (${placeholders})`,
    productIds
  );

  return result.rows || [];
}

function validateAndBuildOrderItems(items, products) {
  const byId = new Map((products || []).map((row) => [Number(row.id), row]));
  const normalized = [];
  let subtotal = 0;

  for (const item of items) {
    const productId = Number(item?.product_id);
    const qty = Math.max(1, Math.min(999, Number(item?.qty) || 1));
    const product = byId.get(productId);

    if (!product) {
      return { error: { status: 400, body: { error: "product_not_found", product_id: productId } } };
    }

    if (Number(product.stock) < qty) {
      return { error: { status: 400, body: { error: "not_enough_stock", product_id: productId } } };
    }

    const price = Number(product.price) || 0;
    subtotal += price * qty;
    normalized.push({
      product_id: productId,
      title: String(product.title || ""),
      price,
      qty,
    });
  }

  return { subtotal, normalized };
}

function normalizeDeliveryInfo(delivery) {
  return {
    method: String(delivery?.method || "").trim(),
    city: String(delivery?.city || "").trim(),
    address: String(delivery?.address || "").trim(),
    phone: String(delivery?.phone || "").trim(),
    price: Math.max(0, Number(delivery?.price || 0) || 0),
  };
}

async function insertOrderItems(client, orderId, items) {
  await ensureOrderItemSellerStateColumns(client);

  for (const item of items) {
    await client.query(
      `INSERT INTO order_items (order_id, product_id, title, price, qty, seller_status, seller_note, seller_updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', '', NOW())`,
      [orderId, item.product_id, item.title, item.price, item.qty]
    );
  }
}

async function decrementProductStock(client, items) {
  for (const item of items) {
    await client.query(
      `UPDATE products
       SET stock = stock - $1
       WHERE id = $2`,
      [item.qty, item.product_id]
    );
  }
}

async function createOrder(pool, userId, payload) {
  const { items, delivery, comment } = normalizeOrderInput(payload);

  if (!items.length) {
    return { error: { status: 400, body: { error: "empty_items" } } };
  }

  const productIds = getUniqueProductIds(items);
  if (!productIds.length) {
    return { error: { status: 400, body: { error: "bad_items" } } };
  }

  const products = await loadProductsForOrder(pool, productIds);
  const built = validateAndBuildOrderItems(items, products);
  if (built.error) return built;

  const deliveryInfo = normalizeDeliveryInfo(delivery);
  const subtotal = Number(built.subtotal || 0);
  const deliveryPrice = deliveryInfo.price;
  const total = subtotal + deliveryPrice;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureOrderItemSellerStateColumns(client);

    const orderResult = await client.query(
      `INSERT INTO orders
       (user_id, status, subtotal, delivery_price, total, delivery_method, delivery_city, delivery_address, phone, comment)
       VALUES ($1, 'created', $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        userId,
        Math.round(subtotal),
        Math.round(deliveryPrice),
        Math.round(total),
        deliveryInfo.method,
        deliveryInfo.city,
        deliveryInfo.address,
        deliveryInfo.phone,
        comment,
      ]
    );

    const orderId = Number(orderResult.rows[0]?.id);
    const normalizedItems = built.normalized || [];

    await insertOrderItems(client, orderId, normalizedItems);
    await decrementProductStock(client, normalizedItems);

    await client.query(
      `INSERT INTO order_status_history(order_id, status, note)
       VALUES ($1, 'pending', '')`,
      [orderId]
    );

    await client.query("COMMIT");
    return { orderId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listSellerSales(pool, sellerUserId) {
  await ensureOrderItemSellerStateColumns(pool);

  const result = await pool.query(
    `SELECT
       oi.id AS sale_id,
       o.id AS order_id,
       COALESCE(oi.seller_status, 'pending') AS status,
       COALESCE(oi.seller_note, '') AS seller_note,
       COALESCE(o.comment, '') AS order_comment,
       o.created_at,
       COALESCE(u.name, '') AS buyer_name,
       COALESCE(u.email, '') AS buyer_email,
       oi.product_id,
       COALESCE(oi.title, p.title, '') AS product_title,
       COALESCE(p.image_url, '') AS image_url,
       COALESCE(oi.price, 0) AS price,
       COALESCE(oi.qty, 0) AS qty,
       (COALESCE(oi.price, 0) * COALESCE(oi.qty, 0))::int AS line_total
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     LEFT JOIN users u ON u.id = o.user_id
     WHERE p.owner_user_id = $1
     ORDER BY o.id DESC, oi.id DESC`,
    [sellerUserId]
  );

  return result.rows || [];
}

function summarizeSellerSales(items) {
  const rows = Array.isArray(items) ? items : [];
  let newCount = 0;
  for (const row of rows) {
    const status = String(row?.status || '').toLowerCase();
    if (status === 'pending' || status === 'paid') newCount += 1;
  }
  return {
    total_count: rows.length,
    new_count: newCount,
  };
}

async function sellerCanAccessSale(pool, saleId, sellerUserId) {
  const result = await pool.query(
    `SELECT
       oi.id AS sale_id,
       oi.order_id,
       o.user_id,
       COALESCE(oi.seller_status, 'pending') AS seller_status
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE oi.id = $1
       AND p.owner_user_id = $2
     LIMIT 1`,
    [saleId, sellerUserId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createOrder,
  ensureOrderItemSellerStateColumns,
  getAccessibleOrder,
  getAccessibleOrderBrief,
  listMyOrders,
  getOrderItems,
  getRepeatOrderItems,
  getOrderHistory,
  queryAccessibleOrder,
  listSellerSales,
  summarizeSellerSales,
  sellerCanAccessSale,
};
