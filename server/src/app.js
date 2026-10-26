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
  auth,
  clientDist,
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "SAMEORIGIN" });
    next();
  });

  // Only the client app may call this server from a browser. clientOrigin is
  // one origin or an array of them (see config.js).
  app.use(cors({ origin: clientOrigin, credentials: true }));
  if (auth) {
    app.set("trust proxy", 1);
    app.use("/api/auth", auth.router);
    app.use("/api/assets", auth.middleware, auth.required, auth.checkOrigin);
  }
  registerAssetRoutes(app);

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  // Socket.IO needs the raw Node HTTP server (not the Express app) so it can
  // take over the connection when the browser upgrades it to a WebSocket.
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: clientOrigin, credentials: true },
    // Reject any single message over ~1 MB (a max-size stroke is far smaller),
    // so one client can't make the server parse huge payloads.
    maxHttpBufferSize: 1e6,
  });
  if (auth) {
    io.use(auth.socketMiddleware);
    auth.onLogout(hash => io.in(`session:${hash}`).disconnectSockets(true));
  }

  io.on("connection", (socket) => {
    if (auth) {
      const session = socket.data.auth;
      socket.join(`session:${session.tokenHash}`);
      const expiry = setTimeout(() => socket.disconnect(true), Math.max(1, session.expiresAt - Date.now()));
      expiry.unref();
      socket.on("disconnect", () => clearTimeout(expiry));
      socket.use(([event, payload], next) => {
        if (Date.now() >= session.expiresAt) return next(new Error("Session expired"));
        if (event === "board:join" && payload && typeof payload === "object") payload.user = { ...payload.user, userId: session.user.id, name: payload.user?.name || session.user.name };
        next();
      });
    }
    logger.log(`connected ${socket.id}`);
    registerBoardHandlers(io, socket, { store, presence, logger, maxElements });
    registerStudioHandlers(io, socket, { studio, presence, logger });

    socket.on("disconnect", (reason) => {
      logger.log(`disconnected ${socket.id} ${reason}`);
    });
  });

  if (clientDist) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method === "GET" && !/^\/(api|assets|socket\.io)(\/|$)/.test(req.path) && req.accepts("html")) return res.sendFile("index.html", { root: clientDist });
      next();
    });
  }

  return { app, httpServer, io, store, presence };
}
