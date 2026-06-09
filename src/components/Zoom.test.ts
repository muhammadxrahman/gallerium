import { describe, it, expect } from "vitest";
import { isDoubleTap } from "./Zoom";

// Zoom.ts only touches the canvas inside initZoom(), so the pure double-tap test imports
// cleanly in node. This guards the touch reset that iOS needs (no `dblclick` for touch).
describe("isDoubleTap", () => {
  it("is true for a quick, nearby second tap", () => {
    expect(isDoubleTap(200, 10)).toBe(true);
    expect(isDoubleTap(0, 0)).toBe(true);
  });

  it("is false when the gap is too long", () => {
    expect(isDoubleTap(400, 10)).toBe(false);
  });

  it("is false when the taps are too far apart", () => {
    expect(isDoubleTap(200, 50)).toBe(false);
  });

  it("requires both conditions together", () => {
    expect(isDoubleTap(299, 29)).toBe(true);
    expect(isDoubleTap(301, 29)).toBe(false);
    expect(isDoubleTap(299, 31)).toBe(false);
  });
});
