import "dotenv/config";
import { createServer } from "./app.js";
import { connectDB } from "./db.js";
import { createBoardStore } from "./boardStore.js";
import { createMongoPersistence } from "./persistence/mongoPersistence.js";

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/whiteboard";

// Connect to the database BEFORE accepting connections, so the first person
// to open a board never hits a server that can't load it.
await connectDB(MONGODB_URI);

const store = createBoardStore(createMongoPersistence());
const { httpServer } = createServer({ clientOrigin: CLIENT_ORIGIN, store });

httpServer.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
