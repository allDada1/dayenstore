const { unauthorized, forbidden, serverError } = require("../utils/http");
const {
  extractBearerToken,
  extractFlexibleToken,
  attachUserFromToken,
} = require("./auth-helpers");

function createAuthMiddleware({ pool }) {
  async function authorize(req, res, token) {
    if (!token) {
      unauthorized(res, "no_token");
      return false;
    }

    const user = await attachUserFromToken(pool, req, token);
    if (!user) {
      unauthorized(res, "bad_token");
      return false;
    }

    return true;
  }

  async function authRequired(req, res, next) {
    try {
      const token = extractBearerToken(req.headers.authorization);
      const ok = await authorize(req, res, token);
      if (!ok) return;
      return next();
    } catch (err) {
      console.error("authRequired error:", err);
      return serverError(res);
    }
  }

  async function authRequiredFlexible(req, res, next) {
    try {
      const token = extractFlexibleToken(req);
      const ok = await authorize(req, res, token);
      if (!ok) return;
      return next();
    } catch (err) {
      console.error("authRequiredFlexible error:", err);
      return serverError(res);
    }
  }

  async function optionalAuth(req, _res, next) {
    try {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) return next();
      await attachUserFromToken(pool, req, token);
      return next();
    } catch (err) {
      console.error("optionalAuth error:", err);
      return next();
    }
  }

  function adminRequired(req, res, next) {
    if (!req.user?.is_admin) {
      return forbidden(res, "admin_only");
    }
    return next();
  }

  return {
    authRequired,
    authRequiredFlexible,
    optionalAuth,
    adminRequired,
  };
}

module.exports = { createAuthMiddleware };
