function extractBearerToken(authorizationHeader) {
  const h = String(authorizationHeader || "").trim();
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? String(m[1] || "").trim() || null : null;
}

function extractFlexibleToken(req) {
  const bearer = extractBearerToken(req?.headers?.authorization);
  if (bearer) return bearer;

  const headerToken = String(
    req?.headers?.["x-market-token"] || req?.headers?.["x-auth-token"] || ""
  ).trim();
  if (headerToken) return headerToken;

  const queryToken = String(req?.query?.token || "").trim();
  return queryToken || null;
}

function mapUser(row) {
  if (!row) return null;
  return {
  id: Number(row.id),
  name: String(row.name || ""),
  email: String(row.email || ""),
  is_admin: !!row.is_admin,
  is_seller: !!row.is_seller,
  seller_access: !!row.seller_access,
  nickname: String(row.nickname || ""),
  avatar_url: String(row.avatar_url || ""),
  theme: String(row.theme || "dark") || "dark",
  lang: String(row.lang || "ru") || "ru",
 };
}

async function readSessionWithUser(pool, token) {
  if (!token) return null;

  const result = await pool.query(
    `SELECT s.token, s.user_id, s.expires_at,
       u.id, u.name, u.email, u.is_admin, u.is_seller,
            COALESCE(u.seller_access, false) AS seller_access,
            COALESCE(u.nickname, '') AS nickname,
            COALESCE(u.avatar_url, '') AS avatar_url,
            COALESCE(u.theme, 'dark') AS theme,
            COALESCE(u.lang, 'ru') AS lang
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = $1
      LIMIT 1`,
    [token]
  );

  const row = result.rows[0] || null;
  if (!row) return null;

  const expiresAt = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return row;
}

async function attachUserFromToken(pool, req, token) {
  const row = await readSessionWithUser(pool, token);
  if (!row) return null;

  req.user = mapUser(row);
  req.token = token;
  return req.user;
}

async function resolveOptionalUserId(pool, authorizationHeader) {
  try {
    const token = extractBearerToken(authorizationHeader);
    if (!token) return null;

    const row = await readSessionWithUser(pool, token);
    return row ? Number(row.user_id) || null : null;
  } catch (err) {
    console.error("resolveOptionalUserId error:", err);
    return null;
  }
}

module.exports = {
  extractBearerToken,
  extractFlexibleToken,
  mapUser,
  readSessionWithUser,
  attachUserFromToken,
  resolveOptionalUserId,
};
