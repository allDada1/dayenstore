function toPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toNonNegativeInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function getTrimmedString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeSpaces(value) {
  return getTrimmedString(value).replace(/\s+/g, " ");
}

function parseRequiredString(value, { min = 1, max = Infinity, normalize = false } = {}) {
  const s = normalize ? normalizeSpaces(value) : getTrimmedString(value);
  if (s.length < min || s.length > max) return null;
  return s;
}

function parseOptionalString(value, { max = Infinity, normalize = false } = {}) {
  if (value == null) return "";
  const s = normalize ? normalizeSpaces(value) : getTrimmedString(value);
  if (s.length > max) return null;
  return s;
}

function parseEnum(value, allowed, fallback = null) {
  const s = getTrimmedString(value).toLowerCase();
  return allowed.includes(s) ? s : fallback;
}

function parseEmail(value) {
  const s = getTrimmedString(value).toLowerCase();
  if (!s || s.length < 5 || !/^\S+@\S+\.\S+$/.test(s)) return null;
  return s;
}

function parseSlug(value, { min = 3, max = 40 } = {}) {
  const s = getTrimmedString(value).toLowerCase();
  if (s.length < min || s.length > max) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(s)) return null;
  return s;
}

function parsePriceNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseStockNumber(value, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseRating(value, { min = 1, max = 5 } = {}) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function parseIdArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((n) => toPositiveInt(n)).filter(Boolean))];
}

module.exports = {
  toPositiveInt,
  toNonNegativeInt,
  getTrimmedString,
  normalizeSpaces,
  parseRequiredString,
  parseOptionalString,
  parseEnum,
  parseEmail,
  parseSlug,
  parsePriceNumber,
  parseStockNumber,
  parseRating,
  parseIdArray,
};
