const { runBackfills } = require("./backfill");
const { pool } = require("./pool");

(async () => {
  try {
    await runBackfills();
    console.log("✅ Backfill completed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
})();
