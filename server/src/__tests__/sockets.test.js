import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startTestServer, connect, waitFor, receivedWithin } from "./helpers.js";

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

async function newClient() {
  const client = await connect(server.url);
  clients.push(client);
  return client;
}

describe("connection", () => {
  it("lets a client connect and the server sees it", async () => {
    const serverSide = new Promise((resolve) => server.io.once("connection", resolve));
    const client = await newClient();
    const serverSocket = await serverSide;

    expect(client.connected).toBe(true);
    expect(serverSocket.id).toBe(client.id);
  });
});

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

describe("live sync (one shared board)", () => {
  it("forwards element:add to the other client but not back to the sender", async () => {
    const a = await newClient();
    const b = await newClient();

    const bGetsIt = waitFor(b, "element:added");
    const aGetsIt = receivedWithin(a, "element:added");
    a.emit("element:add", { element: sampleElement });

    expect(await bGetsIt).toEqual({ element: sampleElement });
    expect(await aGetsIt).toBe(false);
  });

  it("forwards board:clear to the other client as board:cleared", async () => {
    const a = await newClient();
    const b = await newClient();

    const bGetsIt = waitFor(b, "board:cleared");
    const aGetsIt = receivedWithin(a, "board:cleared");
    a.emit("board:clear");

    expect(await bGetsIt).toEqual({ by: "Someone" });
    expect(await aGetsIt).toBe(false);
  });

  it("ignores element:add without an element and keeps running", async () => {
    const a = await newClient();
    const b = await newClient();

    const bGetsIt = receivedWithin(b, "element:added");
    a.emit("element:add");
    a.emit("element:add", "garbage");

    expect(await bGetsIt).toBe(false);
    expect(a.connected && b.connected).toBe(true);
  });
});
