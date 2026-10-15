import { afterEach, describe, expect, it } from "vitest";
import { parseOrigins } from "../config.js";
import { startTestServer } from "./helpers.js";

describe("parseOrigins", () => {
  it("reads a single origin", () => {
    expect(parseOrigins("https://board.example.com")).toEqual(["https://board.example.com"]);
  });

  it("splits a comma-separated list and trims spaces", () => {
    expect(parseOrigins(" https://a.example.com , http://192.168.1.20:5173 ")).toEqual([
      "https://a.example.com",
      "http://192.168.1.20:5173",
    ]);
  });

  it("strips trailing slashes, which would never match a browser's Origin header", () => {
    expect(parseOrigins("https://a.example.com/")).toEqual(["https://a.example.com"]);
  });

  it("ignores empty entries", () => {
    expect(parseOrigins("https://a.example.com,,")).toEqual(["https://a.example.com"]);
  });

  it("falls back to the local Vite dev server when unset or empty", () => {
    expect(parseOrigins(undefined)).toEqual(["http://localhost:5173"]);
    expect(parseOrigins("  ")).toEqual(["http://localhost:5173"]);
  });
});

describe("CORS with several allowed origins", () => {
  let server;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  async function allowOriginFor(origin) {
    const res = await fetch(`${server.url}/health`, { headers: { Origin: origin } });
    expect(await res.json()).toEqual({ ok: true });
    return res.headers.get("access-control-allow-origin");
  }

  it("allows each listed origin and no other", async () => {
    const origins = parseOrigins("https://board.example.com, http://192.168.1.20:5173");
    server = await startTestServer({ clientOrigin: origins });

    expect(await allowOriginFor("https://board.example.com")).toBe("https://board.example.com");
    expect(await allowOriginFor("http://192.168.1.20:5173")).toBe("http://192.168.1.20:5173");
    expect(await allowOriginFor("https://evil.example.com")).toBeNull();
  });
});
