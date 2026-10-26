import "dotenv/config";
import { createServer } from "./app.js";
import { connectDB } from "./db.js";
import { createBoardStore } from "./boardStore.js";
import { createMongoPersistence } from "./persistence/mongoPersistence.js";
import { parseOrigins } from "./config.js";
import { createStudioStore } from "./studioStore.js";
import { Board } from "./models/Board.js";
import { createAuth } from "./auth.js";
import { mongoAuthStore } from "./authStore.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Hosts like Render and Railway choose the port and pass it in PORT.
const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGINS = parseOrigins(process.env.CLIENT_ORIGIN);
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/whiteboard";

// Connect to the database BEFORE accepting connections, so the first person
// to open a board never hits a server that can't load it.
await connectDB(MONGODB_URI);

const store = createBoardStore(createMongoPersistence());
const studio = createStudioStore({
  load: boardId => Board.findOne({ boardId }).lean(),
  save: (boardId, state) => Board.updateOne({ boardId }, { $set: { studio: state } }, { upsert: true }),
});
const accountStore = mongoAuthStore();
await accountStore.init();
const auth = createAuth({ store: accountStore, allowedOrigins: CLIENT_ORIGINS, sameSite: process.env.COOKIE_SAME_SITE || "lax" });
const dist = fileURLToPath(new URL("../../client/dist", import.meta.url));
const { httpServer } = createServer({ clientOrigin: CLIENT_ORIGINS, store, studio, auth, clientDist: existsSync(dist) ? dist : undefined });

httpServer.listen(PORT, () => {
  console.log(`Server listening on ${PORT}, allowing ${CLIENT_ORIGINS.join(", ")}`);
});
