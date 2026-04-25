const express = require("express");
const { ok, badRequest, notFound, serverError } = require("../utils/http");
const { parseRequiredString, parseOptionalString } = require("../utils/validation");

const SELLER_PROFILE_SELECT = `
  SELECT
    id,
    is_seller,
    COALESCE(nickname, '') AS username,
    COALESCE(name, '') AS name,
    COALESCE(avatar_url, '') AS avatar_url,
    COALESCE(seller_banner_url, '') AS banner_url,
    COALESCE(seller_about, '') AS seller_about,
    COALESCE(seller_telegram, '') AS seller_telegram,
    COALESCE(seller_instagram, '') AS seller_instagram,
    COALESCE(seller_whatsapp, '') AS seller_whatsapp,
    COALESCE(seller_tiktok, '') AS seller_tiktok
  FROM users
`;

const SELLER_ACCESS_SQL = `
  SELECT status,
         COALESCE(admin_comment, '') AS admin_comment,
         reviewed_at
  FROM seller_requests
  WHERE user_id = $1
  ORDER BY reviewed_at DESC NULLS LAST, id DESC
  LIMIT 1`;

async function buildSellerAccessError(pool, userId) {
  const result = await pool.query(SELLER_ACCESS_SQL, [userId]);
  const row = result.rows[0] || null;
  return {
    error: "seller_only",
    message: "Доступ продавца сейчас отключён.",
    admin_comment: row?.admin_comment || "",
    seller_status: row?.status || "inactive",
    reviewed_at: row?.reviewed_at || null,
  };
}

async function ensureSeller(pool, req, res) {
  if (!req.user || !req.user.is_seller) {
    const payload = await buildSellerAccessError(pool, req.user?.id || 0);
    res.status(403).json(payload);
    return false;
  }
  return true;
}

function mapSellerProfile(row) {
  if (!row) return null;

  return {
    ...row,
    banner_url: row.banner_url || "",
    about: row.seller_about || "",
    telegram: row.seller_telegram || "",
    instagram: row.seller_instagram || "",
    whatsapp: row.seller_whatsapp || "",
    tiktok: row.seller_tiktok || "",
  };
}

async function loadSellerByUserId(pool, userId) {
  const result = await pool.query(`${SELLER_PROFILE_SELECT} WHERE id = $1`, [userId]);
  return result.rows[0] || null;
}

async function loadSellerByUsername(pool, username) {
  const result = await pool.query(
    `${SELLER_PROFILE_SELECT}
     WHERE LOWER(COALESCE(nickname, '')) = LOWER($1)
     LIMIT 1`,
    [username]
  );
  return result.rows[0] || null;
}

function parseSellerProfileInput(body) {
  const shop_name = parseRequiredString(body?.shop_name, { min: 2, max: 120, normalize: true });
  const avatar_url = parseOptionalString(body?.avatar_url, { max: 2000000 });
  const banner_url = parseOptionalString(body?.banner_url, { max: 2000000 });
  const about = parseOptionalString(body?.about, { max: 5000 });
  const telegram = parseOptionalString(body?.telegram, { max: 500 });
  const instagram = parseOptionalString(body?.instagram, { max: 500 });
  const whatsapp = parseOptionalString(body?.whatsapp, { max: 500 });
  const tiktok = parseOptionalString(body?.tiktok, { max: 500 });

  if (!shop_name) return { error: "bad_shop_name" };
  if (avatar_url == null) return { error: "bad_avatar_url" };
  if (banner_url == null) return { error: "bad_banner_url" };
  if (about == null) return { error: "bad_about" };
  if (telegram == null) return { error: "bad_telegram" };
  if (instagram == null) return { error: "bad_instagram" };
  if (whatsapp == null) return { error: "bad_whatsapp" };
  if (tiktok == null) return { error: "bad_tiktok" };

  return {
    values: {
      shop_name,
      avatar_url: avatar_url || "",
      banner_url: banner_url || "",
      about: about || "",
      telegram: telegram || "",
      instagram: instagram || "",
      whatsapp: whatsapp || "",
      tiktok: tiktok || "",
    },
  };
}

function createSellerProfileRouter({ pool, authRequired, attachImagesToProducts, withProductStats }) {
  const router = express.Router();

  router.get("/seller/me", authRequired, async (req, res) => {
    if (!(await ensureSeller(pool, req, res))) return;

    try {
      const seller = await loadSellerByUserId(pool, req.user.id);
      if (!seller || !seller.is_seller) return notFound(res, "not_seller");

      return ok(res, { seller: mapSellerProfile(seller) });
    } catch (err) {
      console.error("GET /api/seller/me error:", err);
      return serverError(res);
    }
  });

  router.post("/seller/profile", authRequired, async (req, res) => {
    if (!(await ensureSeller(pool, req, res))) return;

    try {
      const parsed = parseSellerProfileInput(req.body);
      if (parsed.error) return badRequest(res, parsed.error);

      const { shop_name, avatar_url, banner_url, about, telegram, instagram, whatsapp, tiktok } = parsed.values;

      await pool.query(
        `UPDATE users
         SET name = $1,
             avatar_url = $2,
             seller_banner_url = $3,
             seller_about = $4,
             seller_telegram = $5,
             seller_instagram = $6,
             seller_whatsapp = $7,
             seller_tiktok = $8
         WHERE id = $9`,
        [
          shop_name,
          avatar_url,
          banner_url,
          about,
          telegram,
          instagram,
          whatsapp,
          tiktok,
          req.user.id,
        ]
      );

      return ok(res);
    } catch (err) {
      console.error("POST /api/seller/profile error:", err);
      return serverError(res);
    }
  });

  router.get("/shop/:username", async (req, res) => {
    try {
      const username = parseRequiredString(req.params.username, { min: 1, max: 64 });
      if (!username) return badRequest(res, "bad_username");

      const seller = await loadSellerByUsername(pool, username);
      if (!seller) return notFound(res);
      if (!seller.is_seller) {
        const payload = await buildSellerAccessError(pool, seller.id);
        return res.status(404).json({
          error: "seller_inactive",
          message: "Магазин временно недоступен.",
          admin_comment: payload.admin_comment,
          seller_status: payload.seller_status,
          reviewed_at: payload.reviewed_at,
        });
      }

      const productsRes = await pool.query(
        `SELECT *
         FROM products
         WHERE owner_user_id = $1
         ORDER BY id DESC`,
        [seller.id]
      );

      let products = productsRes.rows || [];

      try {
        if (typeof attachImagesToProducts === "function") {
          products = await attachImagesToProducts(products);
        }
      } catch (e) {
        console.error("shop products attachImages error:", e);
      }

      const sellerOut = mapSellerProfile(seller);

      if (typeof withProductStats === "function") {
        return await withProductStats(products, null, (out) => ok(res, {
          seller: sellerOut,
          products: out || [],
        }));
      }

      return ok(res, {
        seller: sellerOut,
        products,
      });
    } catch (err) {
      console.error("GET /api/shop/:username error:", err);
      return serverError(res);
    }
  });

  return router;
}

module.exports = { createSellerProfileRouter };
