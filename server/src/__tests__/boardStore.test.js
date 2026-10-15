import { describe, it, expect, vi } from "vitest";
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

// A fake persistence adapter whose methods are spies, so we can see exactly
// when the store talks to the "database".
function spyPersistence(initial = {}) {
  const boards = new Map(Object.entries(initial));
  return {
    load: vi.fn(async (boardId) => [...(boards.get(boardId) ?? [])]),
    append: vi.fn(async (boardId, element) => {
      boards.set(boardId, [...(boards.get(boardId) ?? []), element]);
    }),
    clear: vi.fn(async (boardId) => {
      boards.set(boardId, []);
    }),
  };
}

describe("boardStore (write-through cache)", () => {
  it("loads from persistence only once, then serves from the cache", async () => {
    const persistence = spyPersistence({ board1: [el("a")] });
    const store = createBoardStore(persistence, { logger: silentLogger });

    expect(await store.getElements("board1")).toEqual([el("a")]);
    expect(await store.getElements("board1")).toEqual([el("a")]);
    expect(persistence.load).toHaveBeenCalledTimes(1);
  });

  it("shares one load between two simultaneous joins", async () => {
    const persistence = spyPersistence();
    const store = createBoardStore(persistence, { logger: silentLogger });
    await Promise.all([store.getElements("board1"), store.getElements("board1")]);
    expect(persistence.load).toHaveBeenCalledTimes(1);
  });

  it("writes every added element through to persistence, in order", async () => {
    const persistence = spyPersistence();
    const store = createBoardStore(persistence, { logger: silentLogger });
    await store.addElement("board1", el("a"));
    await store.addElement("board1", el("b"));
    await store.flush("board1");

    expect(persistence.append).toHaveBeenNthCalledWith(1, "board1", el("a"));
    expect(persistence.append).toHaveBeenNthCalledWith(2, "board1", el("b"));
  });

  it("writes a clear through to persistence", async () => {
    const persistence = spyPersistence();
    const store = createBoardStore(persistence, { logger: silentLogger });
    await store.clearBoard("board1");
    await store.flush("board1");
    expect(persistence.clear).toHaveBeenCalledWith("board1");
  });

  it("reloads from persistence after evict", async () => {
    const persistence = spyPersistence();
    const store = createBoardStore(persistence, { logger: silentLogger });
    await store.addElement("board1", el("a"));
    store.evict("board1");

    expect(await store.getElements("board1")).toEqual([el("a")]);
    expect(persistence.load).toHaveBeenCalledTimes(2);
  });

  it("keeps the element in the cache and logs when a write fails", async () => {
    const persistence = spyPersistence();
    persistence.append.mockRejectedValueOnce(new Error("db down"));
    const logger = { ...silentLogger, error: vi.fn() };
    const store = createBoardStore(persistence, { logger });

    await store.addElement("board1", el("a"));
    await store.flush("board1");
    expect(await store.getElements("board1")).toEqual([el("a")]);
    expect(logger.error).toHaveBeenCalled();
  });

  it("does not cache a failed load, so the next call retries", async () => {
    const persistence = spyPersistence();
    persistence.load.mockRejectedValueOnce(new Error("db down"));
    const store = createBoardStore(persistence, { logger: silentLogger });

    await expect(store.getElements("board1")).rejects.toThrow("db down");
    expect(await store.getElements("board1")).toEqual([]);
  });
});
