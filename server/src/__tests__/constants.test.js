import { describe, it, expect } from "vitest";
import { ELEMENT_TYPES, MIN_SIZE, MAX_SIZE } from "../constants.js";

// Trivial test so `npm test` works from day one.
describe("constants", () => {
  it("lists the four element types", () => {
    expect(ELEMENT_TYPES).toEqual(["stroke", "rect", "circle", "line"]);
  });

  it("has a sensible brush size range", () => {
    expect(MIN_SIZE).toBeLessThan(MAX_SIZE);
  });
});
