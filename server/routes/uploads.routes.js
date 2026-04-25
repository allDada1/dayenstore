const express = require("express");
const { badRequest } = require("../utils/http");
const { buildUploadedImageUrl } = require("../utils/upload");

function createUploadsRouter({ authRequiredFlexible, upload }) {
  const router = express.Router();

  router.post(
  "/uploads/image",
  authRequiredFlexible,
  upload.single("image"),
  (req, res) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    // админ
    if (user.is_admin) {
      if (!req.file) return badRequest(res, "no_file");
      return res.json({ url: buildUploadedImageUrl(req.file) });
    }

    // продавец (через seller_access)
    if (user.seller_access) {
      if (!req.file) return badRequest(res, "no_file");
      return res.json({ url: buildUploadedImageUrl(req.file) });
    }

    return res.status(403).json({ error: "no_access" });
  }
);
  return router;
}

module.exports = { createUploadsRouter };
