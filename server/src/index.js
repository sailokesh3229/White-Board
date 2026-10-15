import "dotenv/config";
import express from "express";
import cors from "cors";

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();

// Only the client app may call this server from a browser.
app.use(cors({ origin: CLIENT_ORIGIN }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
