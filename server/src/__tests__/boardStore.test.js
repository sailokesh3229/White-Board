import { describe, it, expect } from "vitest";
import { createBoardStore } from "../boardStore.js";
import { createMemoryPersistence } from "../persistence/memoryPersistence.js";

const silentLogger = { log() {}, warn() {}, error() {} };

function newStore() {
  return createBoardStore(createMemoryPersistence(), { logger: silentLogger });
}

const el = (id) => ({ id, type: "line", color: "#000000", size: 2, x1: 0, y1: 0, x2: 10, y2: 10 });

describe("boardStore (in memory)", () => {
  it("returns added elements in order", async () => {
    const store = newStore();
    await store.addElement("board1", el("a"));
    await store.addElement("board1", el("b"));
    expect(await store.getElements("board1")).toEqual([el("a"), el("b")]);
  });

  it("starts a new board empty", async () => {
    expect(await newStore().getElements("fresh1")).toEqual([]);
  });

  it("clears a board", async () => {
    const store = newStore();
    await store.addElement("board1", el("a"));
    await store.clearBoard("board1");
    expect(await store.getElements("board1")).toEqual([]);
  });

  it("keeps boards independent", async () => {
    const store = newStore();
    await store.addElement("board1", el("a"));
    await store.addElement("board2", el("b"));
    await store.clearBoard("board2");
    expect(await store.getElements("board1")).toEqual([el("a")]);
    expect(await store.getElements("board2")).toEqual([]);
  });
});
