import { describe, it, expect } from "vitest";
import { createPresence } from "../presence.js";

const alice = { userId: "u_alice", name: "Alice", color: "#e8590c" };
const bob = { userId: "u_bob", name: "Bob", color: "#1971c2" };

describe("presence", () => {
  it("adds, lists and removes users per board", () => {
    const presence = createPresence();
    presence.addUser("boardX", "s1", alice);
    presence.addUser("boardX", "s2", bob);
    expect(presence.listUsers("boardX")).toEqual([
      { socketId: "s1", name: "Alice", color: "#e8590c" },
      { socketId: "s2", name: "Bob", color: "#1971c2" },
    ]);
    expect(presence.getUser("boardX", "s2")).toEqual(bob);

    presence.removeUser("boardX", "s1");
    expect(presence.listUsers("boardX").map((u) => u.name)).toEqual(["Bob"]);
  });

  it("keeps boards independent", () => {
    const presence = createPresence();
    presence.addUser("boardX", "s1", alice);
    presence.addUser("boardY", "s2", bob);
    expect(presence.listUsers("boardX").map((u) => u.name)).toEqual(["Alice"]);
    expect(presence.listUsers("boardY").map((u) => u.name)).toEqual(["Bob"]);
  });

  it("removes the board entry when its last user leaves", () => {
    const presence = createPresence();
    presence.addUser("boardX", "s1", alice);
    presence.removeUser("boardX", "s1");
    expect(presence.hasBoard("boardX")).toBe(false);
    expect(presence.listUsers("boardX")).toEqual([]);
  });

  it("ignores removing an unknown user or board", () => {
    const presence = createPresence();
    expect(() => presence.removeUser("nope", "s1")).not.toThrow();
  });
});
