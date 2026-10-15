import { describe, it, expect } from "vitest";
import { BOARD_WIDTH, BOARD_HEIGHT, BOARD_ID_REGEX } from "../constants.js";

// Trivial test so `npm test` works from day one.
describe("constants", () => {
  it("uses a 16:9 board", () => {
    expect(BOARD_WIDTH / BOARD_HEIGHT).toBeCloseTo(16 / 9);
  });

  it("accepts a nanoid(10) style board ID", () => {
    expect(BOARD_ID_REGEX.test("V1StGXR8_Z")).toBe(true);
    expect(BOARD_ID_REGEX.test("a!")).toBe(false);
  });
});
