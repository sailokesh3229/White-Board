import { Board } from "../models/Board.js";

// Same three methods as memoryPersistence, backed by MongoDB.
export function createMongoPersistence() {
  return {
    async load(boardId) {
      // lean() returns a plain object instead of a Mongoose document (faster).
      const board = await Board.findOne({ boardId }).lean();
      return board?.elements ?? [];
    },

    // $push appends inside the database, so we never read-modify-write the
    // whole array. upsert creates the document on the board's first element.
    async append(boardId, element) {
      await Board.updateOne({ boardId }, { $push: { elements: element } }, { upsert: true });
    },

    async clear(boardId) {
      await Board.updateOne({ boardId }, { $set: { elements: [] } }, { upsert: true });
    },
  };
}
