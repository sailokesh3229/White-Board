import express from "express";
import { nanoid } from "nanoid";
import { Asset } from "./models/Asset.js";
import { isValidBoardId } from "./validate.js";

export function registerAssetRoutes(app) {
  app.post("/assets/:boardId", express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "900kb" }), async (req, res) => {
    if (!isValidBoardId(req.params.boardId)) return res.status(400).json({ error: "Invalid workspace" });
    const data = req.body, type = req.get("content-type")?.split(";")[0];
    // Inspect the signature, not just the supplied MIME type; SVG is excluded.
    const valid = Buffer.isBuffer(data) && data.length >= 12 && (
      (type === "image/png" && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
      (type === "image/jpeg" && data[0] === 255 && data[1] === 216 && data[2] === 255) ||
      (type === "image/webp" && data.toString("ascii",0,4) === "RIFF" && data.toString("ascii",8,12) === "WEBP"));
    if (!valid) return res.status(400).json({ error: "Choose a PNG, JPEG or WebP image" });
    try {
      if (await Asset.countDocuments({ boardId: req.params.boardId }) >= 100) return res.status(413).json({ error: "This workspace has reached its 100-upload limit" });
      const assetId = "img_" + nanoid(14);
      await Asset.create({ assetId, boardId: req.params.boardId, type, data });
      res.status(201).json({ assetId });
    } catch { res.status(503).json({ error: "Upload could not be saved. Please retry." }); }
  });
  app.get("/assets/:assetId", async (req, res) => {
    if (!/^img_[A-Za-z0-9_-]{14}$/.test(req.params.assetId)) return res.sendStatus(404);
    try {
      const asset = await Asset.findOne({ assetId: req.params.assetId }).lean();
      if (!asset) return res.sendStatus(404);
      res.set({ "Content-Type": asset.type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
      res.send(Buffer.isBuffer(asset.data) ? asset.data : Buffer.from(asset.data.buffer));
    } catch { res.sendStatus(503); }
  });
  app.use((error, req, res, next) => { if (error?.type === "entity.too.large") res.status(413).json({ error: "Image is too large. Use an image under 900 KB after compression." }); else next(error); });
}
