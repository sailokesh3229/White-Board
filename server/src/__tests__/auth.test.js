import { afterEach, describe, expect, it } from "vitest";
import { io } from "socket.io-client";
import { createAuth, hashPassword, verifyPassword } from "../auth.js";
import { memoryAuthStore } from "../authStore.js";
import { startTestServer, waitFor, joinBoard } from "./helpers.js";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let server;
const clients = [];
afterEach(async () => { clients.forEach(s => s.disconnect()); clients.length = 0; if (server) await server.close(); server = null; });
async function start() { server = await startTestServer({ auth: createAuth({ store: memoryAuthStore(), allowedOrigins: ["http://localhost:5173"], secure: false }) }); }
const values = { name: "Folio tester", email: "tester@example.com", password: "long unique test password" };
async function request(path, body, cookie, origin) {
  const response = await fetch(`${server.url}/api/auth/${path}`, { method: body ? "POST" : "GET", headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { response, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
describe("account authentication", () => {
  it("hashes passwords with unique salts and checks the complete password", async () => {
    const a = await hashPassword(values.password), b = await hashPassword(values.password);
    expect(a).not.toBe(b); expect(a).not.toContain(values.password);
    expect(await verifyPassword(values.password, a)).toBe(true);
    expect(await verifyPassword(values.password + "!", a)).toBe(false);
  });
  it("creates an account, issues an HttpOnly session, and returns only public profile fields", async () => {
    await start(); const result = await request("register", values);
    expect(result.response.status).toBe(200);
    expect(result.response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(result.response.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
    expect(result.body.user).toMatchObject({ name: values.name, email: values.email });
    expect(result.body.user).not.toHaveProperty("passwordHash");
    expect((await request("me", null, result.cookie)).body.user.id).toBe(result.body.user.id);
    expect((await request("me")).body.user).toBeNull();
  });
  it("rejects invalid passwords and rotates the session on a successful login", async () => {
    await start(); const registered = await request("register", values);
    expect((await request("login", { email: values.email, password: "wrong password" })).response.status).toBe(401);
    const signedIn = await request("login", { email: values.email.toUpperCase(), password: values.password }, registered.cookie);
    expect(signedIn.response.status).toBe(200); expect(signedIn.cookie).not.toBe(registered.cookie);
    expect((await request("me", null, registered.cookie)).body.user).toBeNull();
    expect((await request("me", null, signedIn.cookie)).body.user.id).toBe(registered.body.user.id);
  });
  it("protects image access and websocket handshakes, then revokes both on logout", async () => {
    await start();
    expect((await fetch(`${server.url}/api/assets/img_abcdefghijklmn`)).status).toBe(401);
    const guest = io(server.url, { transports: ["websocket"], reconnection: false, forceNew: true }); clients.push(guest);
    expect((await waitFor(guest, "connect_error")).message).toMatch(/sign in/);
    const account = await request("register", values);
    const member = io(server.url, { transports: ["websocket"], reconnection: false, forceNew: true, extraHeaders: { cookie: account.cookie } }); clients.push(member);
    await waitFor(member, "connect");
    await joinBoard(member, "authBoard1", { userId: "u_forged", name: "Demo", color: "#123456" });
    await member.emitWithAck("studio:open", { boardId: "authBoard1" });
    const edit = await member.emitWithAck("studio:action", { id: "act_identity1", type: "objects", pageId: "page_main", changes: [{ id: "el_identity", expectedVersion: null, value: { id: "el_identity", type: "text", x: 10, y: 10, width: 300, height: 100, fontSize: 24, color: "#123456", size: 3, text: "Account identity" } }] });
    expect(edit.state.pages[0].elements[0].createdBy).toBe(account.body.user.id);
    const disconnected = waitFor(member, "disconnect");
    expect((await request("logout", {}, account.cookie)).response.status).toBe(200);
    await disconnected;
    expect((await request("me", null, account.cookie)).body.user).toBeNull();
  });
  it("rejects cross-site account writes and weak signup details", async () => {
    await start();
    expect((await request("register", values, null, "https://unrelated.example")).response.status).toBe(403);
    expect((await request("register", { ...values, password: "short" })).response.status).toBe(400);
  });
  it("serves app JavaScript publicly while keeping uploaded images behind sign-in", async () => {
    const prefix = join(tmpdir(), "folio-static-");
    const dist = await mkdtemp(prefix);
    try {
      await mkdir(join(dist, "assets"));
      await writeFile(join(dist, "assets", "bundle.js"), "console.log('folio');");
      await writeFile(join(dist, "index.html"), "<main>Folio sign in</main>");
      server = await startTestServer({ auth: createAuth({ store: memoryAuthStore(), secure: false }), clientDist: dist });
      expect((await fetch(`${server.url}/assets/bundle.js`)).status).toBe(200);
      expect(await (await fetch(`${server.url}/login`)).text()).toContain("Folio sign in");
      expect((await fetch(`${server.url}/api/assets/img_abcdefghijklmn`)).status).toBe(401);
    } finally { if (dist.startsWith(prefix)) await rm(dist, { recursive: true, force: true }); }
  });
});
