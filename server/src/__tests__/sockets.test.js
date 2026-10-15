import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startTestServer, connect, waitFor, receivedWithin, joinBoard, waitUntil, testUser } from "./helpers.js";
import { createBoardStore } from "../boardStore.js";
import { createMemoryPersistence } from "../persistence/memoryPersistence.js";

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

    expect(await bGetsIt).toEqual({ by: "Tester" });
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

describe("persistence failures and eviction", () => {
  it("sends error:message when a board can't be loaded, and keeps serving other boards", async () => {
    // Swap in a store whose database fails for BOARD_X only.
    await server.close();
    const memory = createMemoryPersistence();
    const flaky = {
      ...memory,
      load: async (boardId) => {
        if (boardId === BOARD_X) throw new Error("db down");
        return memory.load(boardId);
      },
    };
    const silent = { log() {}, warn() {}, error() {} };
    server = await startTestServer({ store: createBoardStore(flaky, { logger: silent }) });

    const a = await newClient();
    const error = waitFor(a, "error:message");
    a.emit("board:join", { boardId: BOARD_X });
    expect(await error).toEqual({ message: "Could not load board, please try again" });

    const b = await newClient();
    expect((await joinBoard(b, BOARD_Y)).elements).toEqual([]);
  });

  it("evicts a board from memory when the last user leaves", async () => {
    const a = await newClient(BOARD_X);
    const b = await newClient(BOARD_X);
    const added = waitFor(b, "element:added");
    a.emit("element:add", { element: sampleElement });
    await added;

    const evicted = [];
    const originalEvict = server.store.evict;
    server.store.evict = (boardId) => {
      evicted.push(boardId);
      originalEvict(boardId);
    };

    a.disconnect();
    await waitUntil(() => server.io.sockets.adapter.rooms.get(BOARD_X)?.size === 1);
    expect(evicted).toEqual([]); // b is still there

    b.disconnect();
    await waitUntil(() => evicted.length === 1);
    expect(evicted).toEqual([BOARD_X]);

    // Reloaded from persistence on the next join.
    const c = await newClient();
    expect((await joinBoard(c, BOARD_X)).elements).toEqual([sampleElement]);
  });
});

// Resolves with the next presence:update whose list has `count` users.
function presenceWith(client, count) {
  return new Promise((resolve) => {
    client.on("presence:update", function handler({ users }) {
      if (users.length !== count) return;
      client.off("presence:update", handler);
      resolve(users);
    });
  });
}

describe("presence", () => {
  it("tells everyone in the room, including the joiner, who is online", async () => {
    const a = await connect(server.url);
    const b = await connect(server.url);
    clients.push(a, b);

    const aSeesTwo = presenceWith(a, 2);
    const bSeesTwo = presenceWith(b, 2);
    await joinBoard(a, BOARD_X, testUser("Alice"));
    await joinBoard(b, BOARD_X, testUser("Bob"));

    const expected = [
      { socketId: a.id, name: "Alice", color: "#e8590c" },
      { socketId: b.id, name: "Bob", color: "#e8590c" },
    ];
    expect(await aSeesTwo).toEqual(expected);
    expect(await bSeesTwo).toEqual(expected);
  });

  it("removes a user who disconnects", async () => {
    const a = await newClient();
    const b = await newClient();
    await joinBoard(a, BOARD_X, testUser("Alice"));
    await joinBoard(b, BOARD_X, testUser("Bob"));

    const aSeesOne = presenceWith(a, 1);
    b.disconnect();
    expect(await aSeesOne).toEqual([{ socketId: a.id, name: "Alice", color: "#e8590c" }]);
  });

  it("removes a user from the old board when they switch boards", async () => {
    const a = await newClient();
    const b = await newClient();
    await joinBoard(a, BOARD_X, testUser("Alice"));
    await joinBoard(b, BOARD_X, testUser("Bob"));

    const aSeesOne = presenceWith(a, 1);
    await joinBoard(b, BOARD_Y, testUser("Bob"));
    expect((await aSeesOne).map((u) => u.name)).toEqual(["Alice"]);
  });

  it("never lists users from another board", async () => {
    const a = await newClient();
    const c = await newClient();
    await joinBoard(c, BOARD_Y, testUser("Carol"));
    const update = waitFor(a, "presence:update");
    await joinBoard(a, BOARD_X, testUser("Alice"));
    expect((await update).users.map((u) => u.name)).toEqual(["Alice"]);
  });

  it("sanitizes the name and color", async () => {
    const a = await newClient();
    const update = waitFor(a, "presence:update");
    a.emit("board:join", { boardId: BOARD_X, user: { userId: "u_x", name: "   ", color: "red" } });
    expect((await update).users[0]).toMatchObject({ name: "Guest", color: "#868e96" });

    const second = waitFor(a, "presence:update");
    a.emit("board:join", { boardId: BOARD_X, user: { name: "x".repeat(100), color: "#123abc" } });
    expect((await second).users[0]).toMatchObject({ name: "x".repeat(20), color: "#123abc" });
  });
});
