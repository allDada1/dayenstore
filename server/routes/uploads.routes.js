const express = require("express");
const { badRequest } = require("../utils/http");
const { uploadImageFile } = require("../services/media-storage");

function createUploadsRouter({ authRequiredFlexible, upload }) {
  const router = express.Router();

  router.post(
    "/uploads/image",
    authRequiredFlexible,
    upload.single("image"),
    async (req, res, next) => {
      try {
        const user = req.user;

        if (!user) {
          return res.status(401).json({ error: "unauthorized" });
        }

        if (!req.file) return badRequest(res, "no_file");

        if (user.is_admin) {
          const url = await uploadImageFile(req.file, { folder: "admin", publicIdPrefix: "admin" });
          return res.json({ url });
        }

        if (user.seller_access) {
          const url = await uploadImageFile(req.file, { folder: "seller", publicIdPrefix: "seller" });
          return res.json({ url });
        }

        return res.status(403).json({ error: "no_access" });
      } catch (err) {
        return next(err);
      }
    }
  );

  return router;
}

module.exports = { createUploadsRouter };
