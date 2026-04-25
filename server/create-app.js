const express = require("express");
const cors = require("cors");
const path = require("path");
const { pool } = require("./db/pool");
const { createReviewsRouter } = require("./routes/reviews.routes");
const { createCategoriesPublicRouter } = require("./routes/categories-public.routes");
const { createAdminCategoriesRouter } = require("./routes/admin-categories.routes");
const { createProductsRouter } = require("./routes/products.routes");
const { createSearchRouter } = require("./routes/search.routes");
const { createNotificationsRouter } = require("./routes/notifications.routes");
const { createSellersRouter } = require("./routes/sellers.routes");
const { createUploadsRouter } = require("./routes/uploads.routes");
const { createAuthRouter } = require("./routes/auth.routes");
const { createOrdersRouter } = require("./routes/orders.routes");
const { createProductActionsRouter } = require("./routes/product-actions.routes");
const { createProfileRouter } = require("./routes/profile.routes");
const { createAdminProductCreateRouter } = require("./routes/admin-product-create.routes");
const { createOrderActionsRouter } = require("./routes/order-actions.routes");
const { createAdminProductsRouter } = require("./routes/admin-products.routes");
const { createAdminToolsRouter } = require("./routes/admin-tools.routes");
const { createAdminSellerRequestsRouter } = require("./routes/admin-seller-requests.routes");
const { createSellerProfileRouter } = require("./routes/seller-profile.routes");
const { createSellerRequestsRouter } = require("./routes/seller-requests.routes");
const { createSellerProductsRouter } = require("./routes/seller-products.routes");
const { createTilesRouter } = require("./routes/tiles.routes");
const { hashPassword, makeSalt, makeToken, nowPlusDays } = require("./utils/crypto");
const { createAuthMiddleware } = require("./middleware/auth");
const { normalizeImagesInput, saveProductImages } = require("./utils/product-images");
const { createProductPresenters } = require("./utils/product-presenters");
const { createUploadMiddleware, ensureDir, isDiskUploadMode } = require("./utils/upload");
const { fail } = require("./utils/http");
const { createEmailService } = require("./services/email");

function createApp({ serveStatic = false } = {}) {
  const app = express();
  const { authRequired, authRequiredFlexible, adminRequired } = createAuthMiddleware({ pool });
  const { attachImagesToProducts, withProductStats } = createProductPresenters(pool);
  const emailService = createEmailService();

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  if (serveStatic) {
    app.use("/", express.static(path.join(__dirname, "..")));
  }

  const uploadsDir = path.join(__dirname, "..", "uploads");
  if (isDiskUploadMode()) {
    ensureDir(uploadsDir);
    app.use("/uploads", express.static(uploadsDir));
  }

  const upload = createUploadMiddleware(uploadsDir);

  app.use("/api/reviews", createReviewsRouter({ pool, authRequired }));
  app.use("/api", createCategoriesPublicRouter({ pool, attachImagesToProducts, withProductStats }));
  app.use("/api", createAdminCategoriesRouter({ pool, authRequired, adminRequired }));
  app.use("/api", createSearchRouter({ pool }));
  app.use("/api", createProductsRouter({ pool, attachImagesToProducts, withProductStats }));
  app.use("/api", createNotificationsRouter({ pool, authRequired }));
  app.use("/api", createSellersRouter({ pool, authRequired, attachImagesToProducts, withProductStats }));
  app.use("/api", createAuthRouter({ pool, authRequired, hashPassword, makeSalt, makeToken, nowPlusDays, emailService }));
  app.use("/api", createOrdersRouter({ pool, authRequired }));
  app.use("/api", createProductActionsRouter({ pool, authRequired, withProductStats }));
  app.use("/api", createProfileRouter({ pool, authRequired, upload, attachImagesToProducts, withProductStats }));
  app.use("/api", createAdminProductCreateRouter({ pool, authRequired, adminRequired, normalizeImagesInput, saveProductImages }));
  app.use("/api", createAdminProductsRouter({ pool, authRequired, adminRequired, normalizeImagesInput, saveProductImages }));
  app.use("/api", createOrderActionsRouter({ pool, authRequired, adminRequired }));
  app.use("/api", createAdminToolsRouter({ pool, authRequired, adminRequired }));
  app.use("/api", createAdminSellerRequestsRouter({ pool, authRequired, adminRequired }));
  app.use("/api", createSellerProfileRouter({ pool, authRequired, attachImagesToProducts, withProductStats }));
  app.use("/api", createSellerRequestsRouter({ pool, authRequired }));
  app.use("/api", createSellerProductsRouter({ pool, authRequired, normalizeImagesInput, saveProductImages }));
  app.use("/api", createTilesRouter({ pool }));
  app.use("/api", createUploadsRouter({ authRequiredFlexible, adminRequired, upload }));

  app.use((err, _req, res, _next) => {
    if (!err) return fail(res, 500, "unknown");
    if (err.message === "bad_file_type") return fail(res, 400, "bad_file_type");
    if (err.code === "LIMIT_FILE_SIZE") return fail(res, 400, "file_too_large");
    return fail(res, 500, "server_error");
  });

  return app;
}

module.exports = { createApp };
