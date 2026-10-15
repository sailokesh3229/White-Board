import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startTestServer, connect, waitFor, receivedWithin, joinBoard } from "./helpers.js";

const BOARD_X = "AAAAAA1111";
const BOARD_Y = "BBBBBB2222";

let server;
let clients;

beforeEach(async () => {
  server = await startTestServer();
  clients = [];
});

// Close everything so Vitest can exit cleanly.
afterEach(async () => {
  for (const client of clients) client.disconnect();
  await server.close();
});

async function newClient(boardId) {
  const client = await connect(server.url);
  clients.push(client);
  if (boardId) await joinBoard(client, boardId);
  return client;
}

const sampleElement = {
  id: "el_test000001",
  type: "line",
  color: "#e03131",
  size: 4,
  x1: 10,
  y1: 20,
  x2: 300,
  y2: 400,
  createdBy: "u_test",
  createdAt: 1730000000000,
};

describe("connection", () => {
  it("lets a client connect and the server sees it", async () => {
    const serverSide = new Promise((resolve) => server.io.once("connection", resolve));
    const client = await newClient();
    const serverSocket = await serverSide;

    expect(client.connected).toBe(true);
    expect(serverSocket.id).toBe(client.id);
  });
});

describe("live sync", () => {
  it("forwards element:add to the other client but not back to the sender", async () => {
    const a = await newClient(BOARD_X);
    const b = await newClient(BOARD_X);

    const bGetsIt = waitFor(b, "element:added");
    const aGetsIt = receivedWithin(a, "element:added");
    a.emit("element:add", { element: sampleElement });

    expect(await bGetsIt).toEqual({ element: sampleElement });
    expect(await aGetsIt).toBe(false);
  });

  it("forwards board:clear to the other client as board:cleared", async () => {
    const a = await newClient(BOARD_X);
    const b = await newClient(BOARD_X);

    const bGetsIt = waitFor(b, "board:cleared");
    const aGetsIt = receivedWithin(a, "board:cleared");
    a.emit("board:clear");

    expect(await bGetsIt).toHaveProperty("by");
    expect(await aGetsIt).toBe(false);
  });

  it("ignores element:add without an element and keeps running", async () => {
    const a = await newClient(BOARD_X);
    const b = await newClient(BOARD_X);

    const bGetsIt = receivedWithin(b, "element:added");
    a.emit("element:add");
    a.emit("element:add", "garbage");

    expect(await bGetsIt).toBe(false);
    expect(a.connected && b.connected).toBe(true);
  });
});

describe("rooms", () => {
  it("keeps boards isolated from each other", async () => {
    const a = await newClient(BOARD_X);
    const b = await newClient(BOARD_X);
    const c = await newClient(BOARD_Y);

    const bGetsIt = waitFor(b, "element:added");
    const cGetsIt = receivedWithin(c, "element:added");
    a.emit("element:add", { element: sampleElement });
    expect(await bGetsIt).toEqual({ element: sampleElement });
    expect(await cGetsIt).toBe(false);

    const aGetsClear = receivedWithin(a, "board:cleared");
    const bGetsClear = receivedWithin(b, "board:cleared");
    c.emit("board:clear");
    expect(await aGetsClear).toBe(false);
    expect(await bGetsClear).toBe(false);
  });

  it("rejects an invalid board ID with error:message", async () => {
    const a = await newClient();
    const error = waitFor(a, "error:message");
    a.emit("board:join", { boardId: "a!" });
    expect(await error).toEqual({ message: "Invalid board ID" });
  });

  it("stops receiving the old board's events after switching boards", async () => {
    const a = await newClient(BOARD_X);
    const switcher = await newClient(BOARD_X);
    await joinBoard(switcher, BOARD_Y);

    expect(server.io.sockets.adapter.rooms.get(BOARD_X)?.has(switcher.id)).toBe(false);
    const getsIt = receivedWithin(switcher, "element:added");
    a.emit("element:add", { element: sampleElement });
    expect(await getsIt).toBe(false);
  });

  it("does not broadcast from a socket that never joined a board", async () => {
    const outsider = await newClient();
    const b = await newClient(BOARD_X);

    const bGetsIt = receivedWithin(b, "element:added");
    outsider.emit("element:add", { element: sampleElement });
    outsider.emit("board:clear");
    expect(await bGetsIt).toBe(false);
  });
});

describe("late joiners", () => {
  const second = { ...sampleElement, id: "el_test000002", x1: 50 };

  it("sends the current board to a new joiner, in order", async () => {
    const a = await newClient(BOARD_X);
    const watcher = await newClient(BOARD_X);

    // Wait until the watcher sees both, so we know the server stored them.
    const seenTwice = new Promise((resolve) => {
      let count = 0;
      watcher.on("element:added", () => ++count === 2 && resolve());
    });
    a.emit("element:add", { element: sampleElement });
    a.emit("element:add", { element: second });
    await seenTwice;

    const late = await newClient();
    const state = await joinBoard(late, BOARD_X);
    expect(state.elements).toEqual([sampleElement, second]);
  });

  it("sends an empty board after a clear", async () => {
    const a = await newClient(BOARD_X);
    const watcher = await newClient(BOARD_X);

    const added = waitFor(watcher, "element:added");
    a.emit("element:add", { element: sampleElement });
    await added;
    const cleared = waitFor(watcher, "board:cleared");
    a.emit("board:clear");
    await cleared;

    const late = await newClient();
    expect((await joinBoard(late, BOARD_X)).elements).toEqual([]);
  });

  it("keeps boards separate in the store", async () => {
    const a = await newClient(BOARD_X);
    const watcher = await newClient(BOARD_X);
    const added = waitFor(watcher, "element:added");
    a.emit("element:add", { element: sampleElement });
    await added;

    const other = await newClient();
    expect((await joinBoard(other, BOARD_Y)).elements).toEqual([]);
  });
});
