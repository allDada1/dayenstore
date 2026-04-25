const express = require("express");
const crypto = require("crypto");

let googleOAuthClient = null;

function getGoogleOAuthClient(clientId) {
  if (!clientId) return null;
  if (googleOAuthClient) return googleOAuthClient;
  const { OAuth2Client } = require("google-auth-library");
  googleOAuthClient = new OAuth2Client(clientId);
  return googleOAuthClient;
}

async function verifyGoogleCredential(credential, clientId) {
  const client = getGoogleOAuthClient(clientId);
  if (!client) throw new Error("google_not_configured");
  const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
  const payload = ticket.getPayload() || {};
  return payload;
}
async function verifyGoogleAccessToken(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) throw new Error("missing_google_access_token");

  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("bad_google_access_token");
  }

  const payload = await response.json().catch(() => ({}));
  return payload || {};
}
const {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  dbError,
  serverError,
} = require("../utils/http");
const {
  parseRequiredString,
  parseEmail,
} = require("../utils/validation");

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function nowPlusMinutes(minutes) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function createAuthRouter({
  pool,
  authRequired,
  hashPassword,
  makeSalt,
  makeToken,
  nowPlusDays,
  emailService,
}) {
  const router = express.Router();


  router.get("/auth/google-config", (_req, res) => {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
    if (!clientId) return notFound(res, "google_not_configured");
    return ok(res, { clientId });
  });

  router.get("/auth/telegram-config", (_req, res) => {
    const botUsername = String(process.env.TELEGRAM_BOT_USERNAME || "").trim();
    const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const loginUrl = String(process.env.TELEGRAM_LOGIN_URL || "").trim().replace(/\/$/, "");

    const missing = [];
    if (!botUsername) missing.push("TELEGRAM_BOT_USERNAME");
    if (!botToken) missing.push("TELEGRAM_BOT_TOKEN");
    if (!loginUrl) missing.push("TELEGRAM_LOGIN_URL");

    const isPublicUrl = /^https?:\/\//i.test(loginUrl) && !/localhost|127\.0\.0\.1/i.test(loginUrl);
    const enabled = missing.length === 0 && isPublicUrl;

    return ok(res, {
      enabled,
      mode: enabled ? "widget_callback" : "setup_required",
      botUsername: botUsername || "",
      loginUrl: loginUrl || "",
      authUrl: enabled ? `${loginUrl}/api/auth/telegram/start` : "",
      callbackUrl: loginUrl ? `${loginUrl}/auth/telegram/callback` : "",
      missing,
      note: enabled
        ? "Telegram login готов к подключению публичного callback-потока."
        : "Для реального Telegram login нужен бот и публичный URL, добавленный в настройках бота.",
    });
  });

  router.get("/auth/telegram/start", (_req, res) => {
    return badRequest(res, "telegram_login_not_enabled_yet");
  });

  router.get("/auth/telegram/callback", (_req, res) => {
    return badRequest(res, "telegram_login_not_enabled_yet");
  });

  router.post("/auth/google", async (req, res) => {
  const credential = String(req.body?.credential || "").trim();
  const accessToken = String(req.body?.access_token || "").trim();
  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();

  if (!clientId) return serverError(res, "google_not_configured");
  if (!credential && !accessToken) return badRequest(res, "missing_google_credential");

  try {
    let payload = {};

    if (credential) {
      payload = await verifyGoogleCredential(credential, clientId);
    } else {
      payload = await verifyGoogleAccessToken(accessToken);
    }

    const email = String(payload.email || "").trim().toLowerCase();
    const googleSub = String(payload.sub || payload.user_id || "").trim();
    const emailVerified =
      payload.email_verified === true ||
      payload.email_verified === "true";
    const name =
      String(payload.name || payload.given_name || "Google User").trim() || "Google User";
    const avatarUrl = String(payload.picture || "").trim();

    if (!email || !googleSub) return unauthorized(res, "bad_google_credentials");
    if (!emailVerified) return unauthorized(res, "google_email_not_verified");

    let userResult = await pool.query(
      `SELECT id, name, email, is_admin, avatar_url
         FROM users
        WHERE LOWER(email) = $1
        LIMIT 1`,
      [email]
    );

    let user = userResult.rows[0];

    if (!user) {
      const salt = makeSalt();
      const generatedPassword = `google:${googleSub}:${makeToken()}`;
      const passHash = hashPassword(generatedPassword, salt);

      const createdUser = await pool.query(
        `INSERT INTO users (name, email, pass_salt, pass_hash, is_admin, avatar_url)
         VALUES ($1, $2, $3, $4, false, $5)
         RETURNING id, name, email, is_admin, avatar_url`,
        [name, email, salt, passHash, avatarUrl]
      );

      user = createdUser.rows[0];
    } else if (!user.avatar_url && avatarUrl) {
      const updated = await pool.query(
        `UPDATE users SET avatar_url = $1 WHERE id = $2
         RETURNING id, name, email, is_admin, avatar_url`,
        [avatarUrl, user.id]
      );
      user = updated.rows[0] || user;
    }

    const token = makeToken();
    const expiresAt = nowPlusDays(30);

    await pool.query(
      `INSERT INTO sessions (token, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [token, user.id, expiresAt]
    );

    return ok(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        is_admin: !!user.is_admin,
        avatar_url: user.avatar_url || "",
      },
    });
  } catch (err) {
    console.error("POST /api/auth/google error:", err);
    return unauthorized(res, "bad_google_credentials");
  }
});

  router.post("/auth/register", async (req, res) => {
    const name = parseRequiredString(req.body?.name, { min: 2, max: 80, normalize: true });
    const email = parseEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!name) return badRequest(res, "bad_name");
    if (!email) return badRequest(res, "bad_email");
    if (password.length < 6) return badRequest(res, "bad_password");

    const salt = makeSalt();
    const passHash = hashPassword(password, salt);

    try {
      const rUser = await pool.query(
        `INSERT INTO users (name, email, pass_salt, pass_hash, is_admin)
         VALUES ($1, $2, $3, $4, false)
         RETURNING id`,
        [name, email, salt, passHash]
      );

      const userId = rUser.rows[0].id;
      const token = makeToken();
      const expiresAt = nowPlusDays(30);

      await pool.query(
        `INSERT INTO sessions (token, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [token, userId, expiresAt]
      );

      return created(res, {
        token,
        user: {
          id: userId,
          name,
          email,
          is_admin: false,
        },
      });
    } catch (err) {
  const msg = String(err?.message || err).toLowerCase();
  const code = String(err?.code || "");

  if (
    code === "23505" ||
    msg.includes("unique") ||
    msg.includes("duplicate key") ||
    msg.includes("users_email_key")
  ) {
    return conflict(res, "email_taken");
  }

  console.error("POST /api/auth/register error:", err);
  return dbError(res, err);
}
  });

  router.post("/auth/login", async (req, res) => {
    const email = parseEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email) return badRequest(res, "bad_email");
    if (!password) return badRequest(res, "bad_password");

    try {
      const result = await pool.query(
        `SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [email]
      );

      const user = result.rows[0];
      if (!user) return unauthorized(res, "bad_credentials");

      const calc = hashPassword(password, user.pass_salt);
      if (calc !== user.pass_hash) {
        return unauthorized(res, "bad_credentials");
      }

      const token = makeToken();
      const expiresAt = nowPlusDays(30);

      await pool.query(
        `INSERT INTO sessions (token, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [token, user.id, expiresAt]
      );

      return ok(res, {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          is_admin: !!user.is_admin,
        },
      });
    } catch (err) {
      console.error("POST /api/auth/login error:", err);
      return dbError(res, err);
    }
  });

  router.post("/auth/forgot-password", async (req, res) => {
    const email = parseEmail(req.body?.email);
    if (!email) return badRequest(res, "bad_email");

    const genericMessage = "Если аккаунт существует, письмо со ссылкой уже отправлено.";

    try {
      const result = await pool.query(
        `SELECT id, name, email FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [email]
      );

      const user = result.rows[0];
      if (!user) return ok(res, { message: genericMessage });

      const rawToken = `${makeToken()}${makeToken()}`;
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = nowPlusMinutes(30);
      const baseUrl = String(emailService?.appBaseUrl || process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
      const resetUrl = `${baseUrl}/reset-password.html?token=${encodeURIComponent(rawToken)}`;

      await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at <= NOW()`, [user.id]);
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );

      await emailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });

      return ok(res, { message: genericMessage });
    } catch (err) {
      console.error("POST /api/auth/forgot-password error:", err);
      return serverError(res, "reset_email_failed");
    }
  });

  router.post("/auth/reset-password", async (req, res) => {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");

    if (!token) return badRequest(res, "missing_token");
    if (password.length < 6) return badRequest(res, "bad_password");

    try {
      const tokenHash = hashResetToken(token);
      const result = await pool.query(
        `SELECT prt.id, prt.user_id
           FROM password_reset_tokens prt
          WHERE prt.token_hash = $1
            AND prt.used_at IS NULL
            AND prt.expires_at > NOW()
          LIMIT 1`,
        [tokenHash]
      );

      const row = result.rows[0];
      if (!row) return badRequest(res, "bad_or_expired_token");

      const salt = makeSalt();
      const passHash = hashPassword(password, salt);

      await pool.query(`UPDATE users SET pass_salt = $1, pass_hash = $2 WHERE id = $3`, [salt, passHash, row.user_id]);
      await pool.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);
      await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [row.user_id]);

      return ok(res, { message: "Пароль обновлён. Теперь можно войти заново." });
    } catch (err) {
      console.error("POST /api/auth/reset-password error:", err);
      return serverError(res, "reset_password_failed");
    }
  });

  router.get("/auth/me", authRequired, (req, res) => ok(res, { user: req.user }));

  router.post("/auth/logout", authRequired, async (req, res) => {
    try {
      await pool.query(`DELETE FROM sessions WHERE token = $1`, [req.token]);
      return ok(res);
    } catch (err) {
      console.error("POST /api/auth/logout error:", err);
      return dbError(res, err);
    }
  });

  router.post("/admin/make-admin", async (req, res) => {
    const secret = String(req.body?.secret || "");
    const expected = process.env.ADMIN_SECRET || "devsecret";
    const email = parseEmail(req.body?.email);

    if (secret !== expected) return forbidden(res, "bad_secret");
    if (!email) return badRequest(res, "bad_email");

    try {
      const result = await pool.query(
        `UPDATE users
         SET is_admin = TRUE
         WHERE LOWER(email) = $1
         RETURNING id`,
        [email]
      );

      if (!result.rows.length) return notFound(res, "user_not_found");
      return ok(res);
    } catch (err) {
      console.error("POST /api/admin/make-admin error:", err);
      return dbError(res, err);
    }
  });

  return router;
}

module.exports = { createAuthRouter };
