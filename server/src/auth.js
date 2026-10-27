import express from "express";
import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { nanoid } from "nanoid";

const derive = promisify(scrypt);
const COOKIE = "folio_session";
const LIFE = 7 * 24 * 60 * 60 * 1000;
const hashToken = token => createHash("sha256").update(token).digest("hex");
const publicUser = user => ({ id: user.userId, name: user.name, email: user.email });
let activeHashes = 0;
async function passwordKey(password, salt) {
  if (activeHashes >= 2) throw Object.assign(new Error("Please try again in a moment."), { status: 429 });
  activeHashes++;
  try { return await derive(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }); }
  finally { activeHashes--; }
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$32768$8$3$${salt}$${(await passwordKey(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== "32768" || parts[2] !== "8" || parts[3] !== "3") return false;
  const expected = Buffer.from(parts[5], "hex");
  const actual = await passwordKey(password, parts[4]);
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
function cookieToken(header) {
  const value = String(header || "").split(";").map(part => part.trim()).find(part => part.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value || "") ? value : null;
}

export function createAuth({ store, allowedOrigins = [], secure = process.env.NODE_ENV === "production", sameSite = "lax" }) {
  const origins = new Set(Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins]);
  const router = express.Router(), limits = new Map();
  let onLogout = () => {};
  const dummyHash = hashPassword(randomBytes(32).toString("hex"));
  const options = { httpOnly: true, secure, sameSite, path: "/", maxAge: LIFE };
  function originAllowed(origin, host) {
    if (!origin) return true;
    try { return origins.has(origin) || new URL(origin).host === host; } catch { return false; }
  }
  function checkOrigin(req, res, next) {
    if (!originAllowed(req.get("origin"), req.get("host"))) return res.status(403).json({ error: "This request came from another site." });
    next();
  }
  function throttle(req, res, next) {
    const now = Date.now();
    if (limits.size > 5000) for (const [key, value] of limits) if (value.until < now) limits.delete(key);
    const key = `${req.ip}:${String(req.body?.email || "").toLowerCase().slice(0,254)}`;
    const ipKey = `ip:${req.ip}`;
    for (const [id, max] of [[key, 10], [ipKey, 40]]) {
      let entry = limits.get(id);
      if (!entry || entry.until < now) { entry = { count: 0, until: now + 15 * 60 * 1000 }; limits.set(id, entry); }
      if (++entry.count > max) { res.set("Retry-After", "900"); return res.status(429).json({ error: "Too many attempts. Please try again in 15 minutes." }); }
    }
    next();
  }
  async function identify(header) {
    const token = cookieToken(header);
    if (!token) return null;
    const tokenHash = hashToken(token), session = await store.findSession(tokenHash);
    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
    const user = await store.findUser(session.userId);
    return user ? { user: publicUser(user), tokenHash, expiresAt: new Date(session.expiresAt).getTime() } : null;
  }
  async function middleware(req, res, next) {
    try { req.auth = await identify(req.headers.cookie); next(); }
    catch { res.status(503).json({ error: "Accounts are temporarily unavailable. Please retry." }); }
  }
  function required(req, res, next) {
    if (!req.auth) return res.status(401).json({ error: "Please sign in to continue." });
    next();
  }
  async function session(res, user, oldCookie) {
    const previous = cookieToken(oldCookie);
    if (previous) {
      const previousHash = hashToken(previous);
      await store.deleteSession(previousHash);
      // Existing sockets have already passed authentication; revoke them too
      // when replacing a session, just as explicit logout does.
      onLogout(previousHash);
    }
    const token = randomBytes(32).toString("base64url");
    await store.createSession({ tokenHash: hashToken(token), userId: user.userId, expiresAt: new Date(Date.now() + LIFE) });
    res.cookie(COOKIE, token, options);
    res.json({ user: publicUser(user) });
  }
  router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.use(express.json({ limit: "8kb" }));
  router.get("/me", middleware, (req, res) => res.json({ user: req.auth?.user || null }));
  router.post("/register", checkOrigin, throttle, async (req, res) => {
    const { name, email, password } = req.body || {};
    if (typeof name !== "string" || !name.trim() || name.trim().length > 20 || typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== "string" || password.length < 10 || password.length > 128) return res.status(400).json({ error: "Use a name up to 20 characters, a valid email, and a password of 10–128 characters." });
    try {
      const user = await store.createUser({ userId: "u_" + nanoid(16), name: name.trim(), email: email.trim().toLowerCase(), passwordHash: await hashPassword(password) });
      await session(res, user, req.headers.cookie);
    } catch (error) { res.status(error.status || (error.code === 11000 ? 409 : 503)).json({ error: error.status ? error.message : error.code === 11000 ? "An account already uses this email. Try signing in." : "Could not create your account. Please retry." }); }
  });
  router.post("/login", checkOrigin, throttle, async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || email.length > 254 || typeof password !== "string" || password.length > 128) return res.status(400).json({ error: "Enter your email and password." });
    try {
      const user = await store.findEmail(email.trim().toLowerCase());
      const valid = await verifyPassword(password, user?.passwordHash || await dummyHash);
      if (!user || !valid) return res.status(401).json({ error: "Email or password is incorrect." });
      await session(res, user, req.headers.cookie);
    } catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : "Sign-in is temporarily unavailable. Please retry." }); }
  });
  router.post("/logout", checkOrigin, middleware, async (req, res) => {
    if (req.auth) { await store.deleteSession(req.auth.tokenHash); onLogout(req.auth.tokenHash); }
    res.clearCookie(COOKIE, { httpOnly: true, secure, sameSite, path: "/" }); res.json({ ok: true });
  });
  async function socketMiddleware(socket, next) {
    try {
      if (!originAllowed(socket.handshake.headers.origin, socket.handshake.headers.host)) return next(new Error("Origin not allowed"));
      const found = await identify(socket.handshake.headers.cookie);
      if (!found) return next(new Error("Please sign in to continue."));
      socket.data.auth = found; next();
    } catch { next(new Error("Sign-in is temporarily unavailable.")); }
  }
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.type === "entity.too.large" ? 413 : 400).json({ error: "Please submit valid account details." });
  });
  return { router, middleware, required, checkOrigin, socketMiddleware, onLogout: callback => { onLogout = callback; } };
}
