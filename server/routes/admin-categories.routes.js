const express = require("express");
const { badRequest, notFound, conflict, serverError, dbError } = require("../utils/http");
const {
  toPositiveInt,
  parseRequiredString,
  parseOptionalString,
  parseSlug,
} = require("../utils/validation");

function isUniqueError(err) {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes("unique") || msg.includes("duplicate key");
}

function parseSortOrder(value, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseActiveFlag(value, fallback = 1) {
  if (value === undefined) return fallback;
  return value ? 1 : 0;
}

function createAdminCategoriesRouter({ pool, authRequired, adminRequired }) {
  const router = express.Router();

  router.get("/admin/categories", authRequired, adminRequired, async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, group_name, section, title, slug, icon_url, emoji, sort_order, is_active
         FROM categories
         ORDER BY section ASC, sort_order ASC, id ASC`
      );

      return res.json(result.rows || []);
    } catch (err) {
      console.error("GET /api/admin/categories error:", err);
      return serverError(res);
    }
  });

  router.get("/admin/categories/check-slug", authRequired, adminRequired, async (req, res) => {
    try {
      const slug = parseSlug(req.query.slug, { min: 1, max: 100 });
      const excludeIdRaw = req.query.exclude_id;
      const excludeId = excludeIdRaw === undefined || excludeIdRaw === "" ? -1 : toPositiveInt(excludeIdRaw);

      if (!slug) return badRequest(res, "missing_slug");
      if (excludeIdRaw !== undefined && excludeIdRaw !== "" && !excludeId) {
        return badRequest(res, "bad_exclude_id");
      }

      const result = await pool.query(
        `SELECT id
         FROM categories
         WHERE slug = $1 AND id <> $2
         LIMIT 1`,
        [slug, excludeId || -1]
      );

      return res.json({ ok: true, available: result.rows.length === 0 });
    } catch (err) {
      console.error("GET /api/admin/categories/check-slug error:", err);
      return serverError(res);
    }
  });

  router.post("/admin/categories", authRequired, adminRequired, async (req, res) => {
    try {
      const section = parseRequiredString(req.body.section ?? "Игры", { min: 1, max: 120, normalize: true });
      const title = parseRequiredString(req.body.title, { min: 1, max: 160, normalize: true });
      const slug = parseSlug(req.body.slug, { min: 1, max: 100 });
      const icon_url = parseOptionalString(req.body.icon_url, { max: 2000 });
      const emoji = parseOptionalString(req.body.emoji, { max: 32 }) ?? "";
      const sort_order = parseSortOrder(req.body.sort_order, 0);
      const is_active = parseActiveFlag(req.body.is_active, 1);

      if (!section || !title || !slug) {
        return badRequest(res, "missing_fields");
      }
      if (icon_url == null) return badRequest(res, "bad_icon_url");
      if (emoji == null) return badRequest(res, "bad_emoji");
      if (sort_order == null) return badRequest(res, "bad_sort_order");

      const result = await pool.query(
        `INSERT INTO categories
         (group_name, section, title, slug, icon_url, emoji, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [section, section, title, slug, icon_url, emoji, sort_order, is_active]
      );

      return res.json({ id: result.rows[0].id });
    } catch (err) {
      console.error("POST /api/admin/categories error:", err);
      if (isUniqueError(err)) return conflict(res, "slug_taken");
      return dbError(res, err);
    }
  });

  router.patch("/admin/categories/:id", authRequired, adminRequired, async (req, res) => {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const fields = [];
      const params = [];
      let idx = 1;

      if (req.body.section !== undefined) {
        const section = parseRequiredString(req.body.section, { min: 1, max: 120, normalize: true });
        if (!section) return badRequest(res, "bad_section");

        fields.push(`section = $${idx++}`);
        params.push(section);

        if (req.body.group_name === undefined) {
          fields.push(`group_name = $${idx++}`);
          params.push(section);
        }
      }

      if (req.body.icon_url !== undefined) {
        const iconUrl = parseOptionalString(req.body.icon_url, { max: 2000 });
        if (iconUrl == null) return badRequest(res, "bad_icon_url");
        fields.push(`icon_url = $${idx++}`);
        params.push(iconUrl);
      }

      if (req.body.group_name !== undefined) {
        const groupName = parseRequiredString(req.body.group_name, { min: 1, max: 120, normalize: true });
        if (!groupName) return badRequest(res, "bad_group_name");
        fields.push(`group_name = $${idx++}`);
        params.push(groupName);
      }

      if (req.body.title !== undefined) {
        const title = parseRequiredString(req.body.title, { min: 1, max: 160, normalize: true });
        if (!title) return badRequest(res, "bad_title");
        fields.push(`title = $${idx++}`);
        params.push(title);
      }

      if (req.body.slug !== undefined) {
        const slug = parseSlug(req.body.slug, { min: 1, max: 100 });
        if (!slug) return badRequest(res, "bad_slug");
        fields.push(`slug = $${idx++}`);
        params.push(slug);
      }

      if (req.body.emoji !== undefined) {
        const emoji = parseOptionalString(req.body.emoji, { max: 32 });
        if (emoji == null) return badRequest(res, "bad_emoji");
        fields.push(`emoji = $${idx++}`);
        params.push(emoji || "🎮");
      }

      if (req.body.sort_order !== undefined) {
        const sortOrder = parseSortOrder(req.body.sort_order);
        if (sortOrder == null) return badRequest(res, "bad_sort_order");
        fields.push(`sort_order = $${idx++}`);
        params.push(sortOrder);
      }

      if (req.body.is_active !== undefined) {
        fields.push(`is_active = $${idx++}`);
        params.push(parseActiveFlag(req.body.is_active));
      }

      if (!fields.length) return badRequest(res, "no_fields");

      params.push(id);

      const result = await pool.query(
        `UPDATE categories
         SET ${fields.join(", ")}
         WHERE id = $${idx}
         RETURNING id`,
        params
      );

      if (!result.rows.length) return notFound(res);

      return res.json({ updated: 1 });
    } catch (err) {
      console.error("PATCH /api/admin/categories/:id error:", err);
      if (isUniqueError(err)) return conflict(res, "slug_taken");
      return serverError(res);
    }
  });

  router.post("/admin/categories/reorder", authRequired, adminRequired, async (req, res) => {
    try {
      const orders = Array.isArray(req.body.orders) ? req.body.orders : [];
      if (!orders.length) return badRequest(res, "missing_orders");

      const clean = [];
      for (const item of orders) {
        const id = toPositiveInt(item?.id);
        const sortOrder = parseSortOrder(item?.sort_order);
        if (!id || sortOrder == null) continue;
        clean.push({ id, sort_order: sortOrder });
      }

      if (!clean.length) return badRequest(res, "bad_orders");

      const valuesSql = clean
        .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
        .join(", ");
      const params = clean.flatMap((item) => [item.id, item.sort_order]);

      await pool.query(
        `UPDATE categories AS c
         SET sort_order = v.sort_order
         FROM (VALUES ${valuesSql}) AS v(id, sort_order)
         WHERE c.id = v.id`,
        params
      );

      return res.json({ ok: true, updated: clean.length });
    } catch (err) {
      console.error("POST /api/admin/categories/reorder error:", err);
      return serverError(res);
    }
  });

  router.delete("/admin/categories/:id", authRequired, adminRequired, async (req, res) => {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const result = await pool.query(
        `DELETE FROM categories WHERE id = $1 RETURNING id`,
        [id]
      );

      if (!result.rows.length) return notFound(res);
      return res.json({ deleted: 1 });
    } catch (err) {
      console.error("DELETE /api/admin/categories/:id error:", err);
      return serverError(res);
    }
  });

  return router;
}

module.exports = { createAdminCategoriesRouter };
