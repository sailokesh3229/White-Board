import { describe, it, expect } from "vitest";
import { getBoardPoint, roundPoint, makeRect, makeCircle, makeLine, isTooSmall } from "../geometry.js";

// A fake 1600x900 canvas shown on screen at 800x450 CSS pixels.
function fakeCanvas(left = 0, top = 0) {
  return {
    width: 1600,
    height: 900,
    getBoundingClientRect: () => ({ left, top, width: 800, height: 450 }),
  };
}

describe("getBoardPoint", () => {
  it("maps the center of the screen rect to the center of the board", () => {
    const point = getBoardPoint({ clientX: 400, clientY: 225 }, fakeCanvas());
    expect(point).toEqual({ x: 800, y: 450 });
  });

  it("maps the top-left corner to (0, 0)", () => {
    const point = getBoardPoint({ clientX: 0, clientY: 0 }, fakeCanvas());
    expect(point).toEqual({ x: 0, y: 0 });
  });

  it("accounts for the canvas being offset on the page", () => {
    const canvas = fakeCanvas(100, 50);
    expect(getBoardPoint({ clientX: 100, clientY: 50 }, canvas)).toEqual({ x: 0, y: 0 });
    expect(getBoardPoint({ clientX: 500, clientY: 275 }, canvas)).toEqual({ x: 800, y: 450 });
  });
});

describe("roundPoint", () => {
  it("rounds to 1 decimal place", () => {
    expect(roundPoint([12.345, 67.891])).toEqual([12.3, 67.9]);
  });
});

describe("makeRect", () => {
  const expected = { x: 10, y: 20, width: 90, height: 60 };

  it("normalizes a drag in all four directions", () => {
    expect(makeRect([10, 20], [100, 80])).toEqual(expected); // down-right
    expect(makeRect([100, 80], [10, 20])).toEqual(expected); // up-left
    expect(makeRect([100, 20], [10, 80])).toEqual(expected); // down-left
    expect(makeRect([10, 80], [100, 20])).toEqual(expected); // up-right
  });

  it("avoids floating point noise in width and height", () => {
    expect(makeRect([0.1, 0.1], [0.4, 0.4])).toEqual({ x: 0.1, y: 0.1, width: 0.3, height: 0.3 });
  });
});

describe("makeCircle", () => {
  it("is centered on the start point with radius = distance dragged", () => {
    expect(makeCircle([100, 100], [130, 140])).toEqual({ cx: 100, cy: 100, r: 50 });
  });

  it("uses Math.hypot for the radius", () => {
    expect(makeCircle([0, 0], [1, 1]).r).toBe(Math.round(Math.hypot(1, 1) * 10) / 10);
  });
});

describe("makeLine", () => {
  it("goes from start to end", () => {
    expect(makeLine([1, 2], [3, 4])).toEqual({ x1: 1, y1: 2, x2: 3, y2: 4 });
  });
});

describe("isTooSmall", () => {
  it("rejects a click (start = end)", () => {
    const p = [50, 50];
    expect(isTooSmall("rect", makeRect(p, p))).toBe(true);
    expect(isTooSmall("circle", makeCircle(p, p))).toBe(true);
    expect(isTooSmall("line", makeLine(p, p))).toBe(true);
  });

  it("accepts a real drag", () => {
    const a = [50, 50];
    const b = [120, 90];
    expect(isTooSmall("rect", makeRect(a, b))).toBe(false);
    expect(isTooSmall("circle", makeCircle(a, b))).toBe(false);
    expect(isTooSmall("line", makeLine(a, b))).toBe(false);
  });

  it("keeps a thin but long rectangle", () => {
    expect(isTooSmall("rect", makeRect([0, 0], [100, 1]))).toBe(false);
  });
});
