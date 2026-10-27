import { afterEach, describe, expect, it, vi } from "vitest";
import { startTestServer, connect, joinBoard, waitFor, testUser } from "./helpers.js";
import { Asset } from "../models/Asset.js";

const boardId = "studioRoom42";
const object = { id: "el_first", type: "text", x: 100, y: 100, width: 400, height: 100, color: "#223344", size: 4, text: "Working together", fontSize: 30, createdBy: "spoofed" };
const action = { id: "act_first", type: "objects", pageId: "page_main", changes: [{ id: object.id, value: object, expectedVersion: null }] };
let server;
const clients = [];
afterEach(async () => { clients.forEach(client => client.disconnect()); clients.length = 0; if (server) await server.close(); server = null; vi.restoreAllMocks(); });
async function client() { const connected = await connect(server.url); clients.push(connected); await joinBoard(connected, boardId, testUser()); return connected; }

describe("studio collaboration protocol", () => {
  it("opens a board, saves an edit, broadcasts it, and lets a late joiner see it", async () => {
    server = await startTestServer();
    const a = await client(), b = await client();
    expect((await a.emitWithAck("studio:open", { boardId })).state.pages).toHaveLength(1);
    await b.emitWithAck("studio:open", { boardId });
    const broadcast = waitFor(b, "studio:changed");
    const result = await a.emitWithAck("studio:action", action);
    expect(result.ok).toBe(true);
    expect((await broadcast).state.pages[0].elements[0]).toMatchObject({ text: "Working together", createdBy: testUser().userId });
    const c = await client();
    const opened = await c.emitWithAck("studio:open", { boardId });
    expect(opened.state.pages[0].elements).toHaveLength(1);
    expect(opened.state.receipts).toContain(action.id);
  });
  it("deduplicates a retried edit without broadcasting it twice", async () => {
    server = await startTestServer(); const a = await client(), b = await client();
    await a.emitWithAck("studio:open", { boardId }); await b.emitWithAck("studio:open", { boardId });
    const broadcasts = []; b.on("studio:changed", data => broadcasts.push(data));
    expect((await a.emitWithAck("studio:action", action)).ok).toBe(true);
    expect((await a.emitWithAck("studio:action", action)).duplicate).toBe(true);
    expect(broadcasts).toHaveLength(1);
  });
  it("rejects edits before opening the studio and keeps other boards isolated", async () => {
    server = await startTestServer(); const a = await client();
    const other = await connect(server.url); clients.push(other);
    await joinBoard(other, "anotherRoom", testUser("Other"));
    expect((await a.emitWithAck("studio:action", action)).ok).toBe(false);
    expect((await other.emitWithAck("studio:open", { boardId })).ok).toBe(false);
    expect((await a.emitWithAck("studio:open", { boardId })).ok).toBe(true);
    expect((await a.emitWithAck("studio:action", action)).ok).toBe(true);
    expect((await other.emitWithAck("studio:open", { boardId })).ok).toBe(false);
  });
  it("rejects malformed event arguments and still accepts a subsequent valid edit", async () => {
    server = await startTestServer(); const a = await client();
    for (const payload of [null, false, 42, "invalid", []]) {
      expect((await a.timeout(1000).emitWithAck("studio:open", payload)).ok).toBe(false);
    }
    a.emit("studio:open", null, { not: "a callback" });
    expect((await a.timeout(1000).emitWithAck("studio:open", { boardId })).ok).toBe(true);
    a.emit("studio:action", null, { not: "a callback" });
    expect((await a.timeout(1000).emitWithAck("studio:action", null)).ok).toBe(false);
    expect((await a.timeout(1000).emitWithAck("studio:action", action)).ok).toBe(true);
    expect((await fetch(`${server.url}/health`)).status).toBe(200);
  });
  it("rejects invalid image payloads before trying to write to MongoDB", async () => {
    server = await startTestServer();
    const response = await fetch(`${server.url}/api/assets/${boardId}`, { method: "POST", headers: { "content-type": "image/png" }, body: Buffer.from("this is not a PNG") });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/PNG/);
  });
  it("stores a bounded image and serves the exact bytes", async () => {
    server = await startTestServer();
    const bytes = Buffer.from("RIFF1234WEBPsample");
    vi.spyOn(Asset, "countDocuments").mockResolvedValue(0);
    vi.spyOn(Asset, "create").mockResolvedValue({});
    vi.spyOn(Asset, "findOne").mockReturnValue({ lean: async () => ({ type: "image/webp", data: bytes }) });
    const upload = await fetch(`${server.url}/api/assets/${boardId}`, { method: "POST", headers: { "content-type": "image/webp" }, body: bytes });
    expect(upload.status).toBe(201);
    const { assetId } = await upload.json();
    expect(assetId).toMatch(/^img_/);
    const image = await fetch(`${server.url}/api/assets/${assetId}`);
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toMatch(/image\/webp/);
    expect(Buffer.from(await image.arrayBuffer())).toEqual(bytes);
  });
});
