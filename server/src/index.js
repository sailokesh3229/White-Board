import "dotenv/config";
import { createServer } from "./app.js";

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const { httpServer } = createServer({ clientOrigin: CLIENT_ORIGIN });

httpServer.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
