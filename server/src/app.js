import http from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { registerBoardHandlers } from "./sockets/boardHandlers.js";
import { createBoardStore } from "./boardStore.js";
import { createMemoryPersistence } from "./persistence/memoryPersistence.js";
import { createPresence } from "./presence.js";
import { createStudioStore } from "./studioStore.js";
import { registerStudioHandlers } from "./studioHandlers.js";
import { registerAssetRoutes } from "./assets.js";

// Builds the HTTP + Socket.IO server without starting it, so tests can create
// as many isolated servers as they like (each on a random port) and no test
// ever needs a real database. index.js does the real startup.
export function createServer({
  clientOrigin = "http://localhost:5173",
  logger = console,
  store = createBoardStore(createMemoryPersistence(), { logger }),
  presence = createPresence(),
  maxElements,
  studio = createStudioStore(),
} = {}) {
  const app = express();

  // Only the client app may call this server from a browser. clientOrigin is
  // one origin or an array of them (see config.js).
  app.use(cors({ origin: clientOrigin }));
  registerAssetRoutes(app);

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  // Socket.IO needs the raw Node HTTP server (not the Express app) so it can
  // take over the connection when the browser upgrades it to a WebSocket.
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: clientOrigin },
    // Reject any single message over ~1 MB (a max-size stroke is far smaller),
    // so one client can't make the server parse huge payloads.
    maxHttpBufferSize: 1e6,
  });

  io.on("connection", (socket) => {
    logger.log(`connected ${socket.id}`);
    registerBoardHandlers(io, socket, { store, presence, logger, maxElements });
    registerStudioHandlers(io, socket, { studio, presence, logger });

    socket.on("disconnect", (reason) => {
      logger.log(`disconnected ${socket.id} ${reason}`);
    });
  });

  return { app, httpServer, io, store, presence };
}
