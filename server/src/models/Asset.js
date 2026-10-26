import mongoose from "mongoose";
export const Asset = mongoose.model("Asset", new mongoose.Schema({
  assetId: { type: String, unique: true, index: true },
  boardId: { type: String, index: true },
  type: String,
  data: Buffer,
}, { timestamps: true }));
