import { describe, expect, it } from "vitest";
import { hidePassword } from "../db.js";

describe("hidePassword", () => {
  it("hides the user and password of an Atlas URI", () => {
    expect(hidePassword("mongodb+srv://me:secret@cluster0.x.mongodb.net/whiteboard")).toBe(
      "mongodb+srv://***@cluster0.x.mongodb.net/whiteboard",
    );
  });

  it("hides all of a password that itself contains an @", () => {
    expect(hidePassword("mongodb+srv://me:pa@ss@cluster0.x.mongodb.net/whiteboard?w=majority")).toBe(
      "mongodb+srv://***@cluster0.x.mongodb.net/whiteboard?w=majority",
    );
  });

  it("leaves a URI without credentials unchanged", () => {
    expect(hidePassword("mongodb://127.0.0.1:27017/whiteboard")).toBe("mongodb://127.0.0.1:27017/whiteboard");
  });
});
