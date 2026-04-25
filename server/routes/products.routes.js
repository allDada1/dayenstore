const express = require("express");
const { normalizeSort, sortProducts, toPositiveInt } = require("../utils/product-query");
const { resolveOptionalUserId } = require("../middleware/auth-helpers");
const { ok, badRequest, notFound, serverError } = require("../utils/http");
const { toPositiveInt: parseId, getTrimmedString } = require("../utils/validation");

function createProductsRouter({ pool, attachImagesToProducts, withProductStats }) {
  const router = express.Router();

  router.get("/products", async (req, res) => {
    try {
      const q = getTrimmedString(req.query.q);
      const cat = getTrimmedString(req.query.cat);
      const { sort, dir } = normalizeSort(req.query.sort, req.query.dir);

      const hasPaging = req.query.limit !== undefined || req.query.offset !== undefined;
      const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);
      const offset = toPositiveInt(req.query.offset, 0);

      const where = [];
      const params = [];
      let idx = 1;

      if (q) {
        where.push(`
          (
            p.title ILIKE $${idx}
            OR p.description ILIKE $${idx}
            OR p.category ILIKE $${idx}
          )
        `);
        params.push(`%${q}%`);
        idx += 1;
      }

      if (cat && cat !== "Все") {
        where.push(`p.category = $${idx}`);
        params.push(cat);
        idx += 1;
      }

      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      const needsPostStatsSort = sort === "likes" || sort === "rating";

      if (needsPostStatsSort) {
        const result = await pool.query(
          `SELECT p.*
           FROM products p
           ${whereSql}
           ORDER BY p.id DESC`,
          params
        );

        let rows = result.rows || [];
        try {
          rows = await attachImagesToProducts(rows);
        } catch (e) {
          console.error("products attachImagesToProducts error:", e);
        }

        return await withProductStats(rows, null, (out) => {
          const prepared = sortProducts(out || [], sort, dir);
          if (!hasPaging) return ok(res, { items: prepared });

          const total = prepared.length;
          const items = prepared.slice(offset, offset + limit);
          const has_more = offset + items.length < total;
          return ok(res, { items, total, limit, offset, has_more });
        });
      }

      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM products p
         ${whereSql}`,
        params
      );
      const total = Number(countRes.rows?.[0]?.total || 0);

      let sql = `
        SELECT p.*
        FROM products p
        ${whereSql}
      `;

      if (sort === "price") {
        sql += ` ORDER BY p.price ${dir === "asc" ? "ASC" : "DESC"}, p.id DESC`;
      } else {
        sql += ` ORDER BY p.id DESC`;
      }

      const finalParams = params.slice();
      if (hasPaging) {
        sql += ` LIMIT $${idx} OFFSET $${idx + 1}`;
        finalParams.push(limit, offset);
      }

      const result = await pool.query(sql, finalParams);
      let rows = result.rows || [];

      try {
        rows = await attachImagesToProducts(rows);
      } catch (e) {
        console.error("products attachImagesToProducts error:", e);
      }

      return await withProductStats(rows, null, (out) => {
        const prepared = sortProducts(out || [], sort, dir);
        if (!hasPaging) return ok(res, { items: prepared });

        const has_more = offset + prepared.length < total;
        return ok(res, { items: prepared, total, limit, offset, has_more });
      });
    } catch (err) {
      console.error("GET /api/products error:", err);
      return serverError(res);
    }
  });

  router.get("/products/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const result = await pool.query(`SELECT * FROM products WHERE id = $1`, [id]);
      const row = result.rows[0];
      if (!row) return notFound(res);

      let prepared = row;
      try {
        prepared = (await attachImagesToProducts([row]))[0] || row;
      } catch (e) {
        console.error("product attachImagesToProducts error:", e);
      }

      const optionalUserId = await resolveOptionalUserId(pool, req.headers.authorization);
      return await withProductStats(prepared, optionalUserId, (out) => ok(res, { product: out[0] }));
    } catch (err) {
      console.error("GET /api/products/:id error:", err);
      return serverError(res);
    }
  });

  return router;
}

module.exports = { createProductsRouter };
