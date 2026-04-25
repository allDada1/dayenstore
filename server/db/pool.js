const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const { Pool } = require("pg");

const connectionString = String(process.env.DATABASE_URL || "").trim();
const isLocalDatabase = /localhost|127\.0\.0\.1/i.test(connectionString);
const forceSsl = String(process.env.DATABASE_SSL || "").trim().toLowerCase();
const useSsl = Boolean(
  connectionString &&
  (forceSsl === "true" || (forceSsl !== "false" && (process.env.NETLIFY === "true" || !isLocalDatabase)))
);

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

module.exports = { pool };
