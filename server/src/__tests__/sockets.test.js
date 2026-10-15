import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startTestServer, connect } from "./helpers.js";

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
