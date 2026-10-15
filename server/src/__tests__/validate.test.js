import { describe, it, expect } from "vitest";
import { cleanElement, isValidElement, isValidBoardId, isValidPoint, sanitizeUser } from "../validate.js";

const base = { id: "el_abc123", color: "#1e1e1e", size: 4, createdBy: "u_test", createdAt: 1730000000000 };
const valid = {
  pen: { ...base, type: "stroke", tool: "pen", points: [[10, 10], [20, 25.5]] },
  eraser: { ...base, type: "stroke", tool: "eraser", points: [[5, 5]] },
  rect: { ...base, type: "rect", x: 10, y: 20, width: 100, height: 50 },
  circle: { ...base, type: "circle", cx: 800, cy: 450, r: 60 },
  line: { ...base, type: "line", x1: 0, y1: 0, x2: 1600, y2: 900 },
};

describe("isValidElement: valid examples", () => {
  for (const [name, element] of Object.entries(valid)) {
    it(`accepts a ${name}`, () => {
      expect(cleanElement(element)).toEqual({ element });
    });
  }

  it("accepts an eraser stroke without a color", () => {
    const { color: _ignored, ...noColor } = valid.eraser;
    expect(isValidElement(noColor)).toBe(true);
  });

  it("accepts points slightly outside the board", () => {
    expect(isValidElement({ ...valid.pen, points: [[-50, -50], [1650, 950]] })).toBe(true);
  });
});

describe("isValidElement: invalid examples", () => {
  const cases = {
    "not an object": null,
    "an array": [],
    "an unknown type": { ...valid.rect, type: "hack" },
    "a missing id": { ...valid.rect, id: undefined },
    "a non-string id": { ...valid.rect, id: 42 },
    "an id over 40 chars": { ...valid.rect, id: "x".repeat(41) },
    "NaN": { ...valid.rect, x: NaN },
    "Infinity": { ...valid.circle, r: Infinity },
    "a string number": { ...valid.line, x1: "10" },
    "x out of range": { ...valid.line, x2: 1701 },
    "y out of range": { ...valid.line, y1: -101 },
    "a rect running off the board": { ...valid.rect, x: 1600, width: 200 },
    "a negative width": { ...valid.rect, width: -5 },
    "size 0": { ...valid.pen, size: 0 },
    "size 41": { ...valid.pen, size: 41 },
    "a missing size": { ...valid.pen, size: undefined },
    "a bad color": { ...valid.pen, color: "red" },
    "a short hex color": { ...valid.pen, color: "#fff" },
    "a pen without color": { ...valid.pen, color: undefined },
    "a bad tool": { ...valid.pen, tool: "spray" },
    "no points": { ...valid.pen, points: [] },
    "points not an array": { ...valid.pen, points: "10,10" },
    "a point with 3 numbers": { ...valid.pen, points: [[1, 2, 3]] },
    "a point with NaN": { ...valid.pen, points: [[1, NaN]] },
    "a missing circle center": { ...valid.circle, cx: undefined },
  };

  for (const [name, element] of Object.entries(cases)) {
    it(`rejects ${name}`, () => {
      expect(isValidElement(element)).toBe(false);
    });
  }

  it("rejects an oversized stroke (5,001 and 100,000 points)", () => {
    const points = (n) => Array.from({ length: n }, (_, i) => [i % 1600, 10]);
    expect(isValidElement({ ...valid.pen, points: points(5000) })).toBe(true);
    expect(isValidElement({ ...valid.pen, points: points(5001) })).toBe(false);
    expect(isValidElement({ ...valid.pen, points: points(100000) })).toBe(false);
  });
});

describe("cleanElement strips extra fields", () => {
  it("keeps only the allowed fields", () => {
    const dirty = { ...valid.rect, onclick: "alert(1)", huge: "x".repeat(1000), points: [[1, 1]] };
    expect(cleanElement(dirty).element).toEqual(valid.rect);
  });

  it("copies stroke points instead of reusing extra data on them", () => {
    const point = [10, 10];
    point.extra = "nope";
    const { element } = cleanElement({ ...valid.pen, points: [point] });
    expect(element.points).toEqual([[10, 10]]);
    expect(element.points[0]).not.toBe(point);
  });
});

describe("other validators", () => {
  it("checks board IDs", () => {
    expect(isValidBoardId("V1StGXR8_Z")).toBe(true);
    expect(isValidBoardId("a!")).toBe(false);
    expect(isValidBoardId(123456)).toBe(false);
  });

  it("checks points", () => {
    expect(isValidPoint(0, 0)).toBe(true);
    expect(isValidPoint(NaN, 0)).toBe(false);
    expect(isValidPoint(0, 1001)).toBe(false);
  });

  it("sanitizes users", () => {
    expect(sanitizeUser({ userId: "u_ok", name: "  Priya  ", color: "#e8590c" })).toEqual({
      userId: "u_ok",
      name: "Priya",
      color: "#e8590c",
    });
    expect(sanitizeUser(undefined)).toEqual({ userId: "u_unknown", name: "Guest", color: "#868e96" });
    expect(sanitizeUser({ name: "x".repeat(100) }).name).toHaveLength(20);
  });
});
