const { migrate } = require("./migrate");
const { pool } = require("./pool");

(async () => {
  try {
    await migrate();
    console.log("✅ Migration completed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
})();
