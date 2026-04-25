function ok(res, data = {}) {
  return res.json({ ok: true, ...data });
}

function created(res, data = {}) {
  return res.status(201).json({ ok: true, ...data });
}

function badRequest(res, error = "bad_request", details) {
  return res.status(400).json(details ? { ok: false, error, details } : { ok: false, error });
}

function unauthorized(res, error = "unauthorized", details) {
  return res.status(401).json(details ? { ok: false, error, details } : { ok: false, error });
}

function forbidden(res, error = "forbidden", details) {
  return res.status(403).json(details ? { ok: false, error, details } : { ok: false, error });
}

function notFound(res, error = "not_found", details) {
  return res.status(404).json(details ? { ok: false, error, details } : { ok: false, error });
}

function conflict(res, error = "conflict", details) {
  return res.status(409).json(details ? { ok: false, error, details } : { ok: false, error });
}

function serverError(res, error = "server_error", details) {
  return res.status(500).json(details ? { ok: false, error, details } : { ok: false, error });
}

function dbError(res, err, fallback = "db_error") {
  return res.status(500).json({
    ok: false,
    error: fallback,
    details: err?.message || String(err),
  });
}

module.exports = {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError,
  dbError,
};
