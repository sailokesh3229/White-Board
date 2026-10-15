import { describe, it, expect } from "vitest";
import { extractBoardId } from "../boardLink.js";

describe("extractBoardId", () => {
  it("returns a bare ID unchanged (ignoring spaces)", () => {
    expect(extractBoardId("  V1StGXR8_Z ")).toBe("V1StGXR8_Z");
  });

  it("takes the last path segment of a full URL", () => {
    expect(extractBoardId("http://localhost:5173/board/V1StGXR8_Z")).toBe("V1StGXR8_Z");
    expect(extractBoardId("https://example.com/board/V1StGXR8_Z/?x=1#y")).toBe("V1StGXR8_Z");
  });

  it("handles a path without a host", () => {
    expect(extractBoardId("/board/V1StGXR8_Z")).toBe("V1StGXR8_Z");
  });

  it("returns an empty string for empty input", () => {
    expect(extractBoardId("   ")).toBe("");
  });
});
