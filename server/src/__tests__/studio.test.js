import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createStudioStore } from "../studioStore.js";
import { applyStudioAction, emptyStudio, migrateStudio, cleanObject } from "../studioDomain.js";

const object = (id = "el_one") => ({ id, type: "text", x: 100, y: 100, width: 300, height: 100, color: "#123456", size: 4, text: "Hello", fontSize: 32 });
const add = (id = "action_one", value = object()) => ({ id, type: "objects", pageId: "page_main", changes: [{ id: value.id, value, expectedVersion: null }] });
describe("studio editing", () => {
  it("keeps deployment-local browser and server domain modules identical", async () => {
    const server = await readFile(new URL("../studioDomain.js", import.meta.url), "utf8");
    const client = await readFile(new URL("../../../client/src/lib/studioDomain.js", import.meta.url), "utf8");
    expect(server.replaceAll("\r\n", "\n")).toBe(client.replaceAll("\r\n", "\n"));
  });
  it("preserves legacy drawings on the first page", () => {
    const old = { id: "old", type: "stroke", points: [[1, 2]] };
    expect(migrateStudio({ elements: [old] }).pages[0].elements[0]).toEqual({ ...old, version: 1 });
  });
  it("serializes concurrent edits and rejects a stale version", async () => {
    const store = createStudioStore();
    await store.act("board1", add(), "alice");
    const edit = (id, text) => ({ id, type: "objects", pageId: "page_main", changes: [{ id: "el_one", value: { ...object(), text }, expectedVersion: 1 }] });
    const results = await Promise.allSettled([store.act("board1", edit("action_two", "A"), "alice"), store.act("board1", edit("action_three", "B"), "bob")]);
    expect(results.map(r => r.status)).toEqual(["fulfilled", "rejected"]);
    expect((await store.get("board1")).pages[0].elements[0].text).toBe("A");
  });
  it("does not acknowledge a failed database write or change the cache", async () => {
    const store = createStudioStore({ save: async () => { throw new Error("db down"); } });
    await expect(store.act("board1", add(), "alice")).rejects.toThrow("db down");
    expect((await store.get("board1")).pages[0].elements).toEqual([]);
  });
  it("deduplicates replayed edits, including after cache eviction", async () => {
    const store = createStudioStore();
    await store.act("board1", add(), "alice"); store.evict("board1");
    expect((await store.act("board1", add(), "alice")).duplicate).toBe(true);
    expect((await store.get("board1")).pages[0].elements).toHaveLength(1);
  });
  it("supports undoing an insertion without removing somebody else's element", async () => {
    const store = createStudioStore();
    await store.act("board1", add(), "alice");
    await store.act("board1", add("action_two", object("el_two")), "bob");
    await store.act("board1", { id: "action_undo", type: "objects", pageId: "page_main", changes: [{ id: "el_one", value: null, expectedVersion: 1 }] }, "alice");
    expect((await store.get("board1")).pages[0].elements.map(e => e.id)).toEqual(["el_two"]);
  });
  it("copies slides with independent IDs and enforces a 20-page limit", () => {
    let state = applyStudioAction(emptyStudio(), add());
    state = applyStudioAction(state, { type: "page:add", newId: "copy", copyFrom: "page_main" });
    expect(state.pages[1].elements[0].id).not.toBe("el_one");
    for (let i = 2; i < 20; i++) state = applyStudioAction(state, { type: "page:add", newId: `page_${i}` });
    expect(() => applyStudioAction(state, { type: "page:add", newId: "overflow" })).toThrow("20 pages");
    expect(() => applyStudioAction(emptyStudio(), { type: "page:remove", pageId: "page_main" })).toThrow("at least one");
  });
  it("rejects script URLs and oversized text without trusting extra fields", () => {
    expect(() => cleanObject({ ...object(), type: "image", assetId: "javascript:alert(1)" })).toThrow();
    expect(() => cleanObject({ ...object(), text: "x".repeat(4001) })).toThrow();
    expect(cleanObject({ ...object(), onclick: "evil" })).not.toHaveProperty("onclick");
  });
});
