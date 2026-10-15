import { describe, it, expect } from "vitest";
import { getBoardPoint, roundPoint } from "../geometry.js";

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
