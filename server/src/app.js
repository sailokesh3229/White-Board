import http from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { registerBoardHandlers } from "./sockets/boardHandlers.js";
import { createBoardStore } from "./boardStore.js";
import { createMemoryPersistence } from "./persistence/memoryPersistence.js";
import { createPresence } from "./presence.js";

// Builds the HTTP + Socket.IO server without starting it, so tests can create
// as many isolated servers as they like (each on a random port) and no test
// ever needs a real database. index.js does the real startup.
export function createServer({
  clientOrigin = "http://localhost:5173",
  logger = console,
  store = createBoardStore(createMemoryPersistence(), { logger }),
  presence = createPresence(),
} = {}) {
  const app = express();

  // Only the client app may call this server from a browser.
  app.use(cors({ origin: clientOrigin }));

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  // Socket.IO needs the raw Node HTTP server (not the Express app) so it can
  // take over the connection when the browser upgrades it to a WebSocket.
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: clientOrigin },
  });

  io.on("connection", (socket) => {
    logger.log(`connected ${socket.id}`);
    registerBoardHandlers(io, socket, { store, presence, logger });

    socket.on("disconnect", (reason) => {
      logger.log(`disconnected ${socket.id} ${reason}`);
    });
  });

  return { app, httpServer, io, store, presence };
}
