import { io as connectClient } from "socket.io-client";
import { createServer } from "../app.js";

const silentLogger = { log() {}, warn() {}, error() {} };

// Starts a fresh server on a random free port (listen(0)).
export async function startTestServer(options = {}) {
  const { httpServer, io } = createServer({ clientOrigin: "*", logger: silentLogger, ...options });
  await new Promise((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address();

  return {
    url: `http://localhost:${port}`,
    io,
    // io.close() disconnects every socket and also closes the HTTP server.
    close: () => new Promise((resolve) => io.close(() => resolve())),
  };
}

// Connects a new client and resolves once it is connected.
// forceNew gives every test client its own connection, like separate tabs.
export async function connect(url) {
  const socket = connectClient(url, { forceNew: true, transports: ["websocket"], reconnection: false });
  await waitFor(socket, "connect");
  return socket;
}

// Resolves with the payload of the next `event`, or rejects after timeoutMs.
export function waitFor(socket, event, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);

    function handler(payload) {
      clearTimeout(timer);
      resolve(payload);
    }

    socket.once(event, handler);
  });
}

// Resolves true if `event` arrives within ms, false otherwise. Used to check
// that something was NOT received.
export function receivedWithin(socket, event, ms = 200) {
  return waitFor(socket, event, ms).then(
    () => true,
    () => false,
  );
}
