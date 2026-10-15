import mongoose from "mongoose";

const { Schema, model } = mongoose;

// One document per board. Elements are stored as plain JSON objects in the
// order they were drawn (spec Section 4.2). Mixed means Mongoose doesn't
// enforce a shape; the server validates elements before storing them.
const boardSchema = new Schema(
  {
    boardId: { type: String, required: true, unique: true, index: true },
    elements: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true },
);

export const Board = model("Board", boardSchema);
