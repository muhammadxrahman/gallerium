import { describe, it, expect, afterEach } from "vitest";
import { getOrientation, getHeadingOffset, setHeadingOffset, normalizeHeading } from "./Orientation";

// Orientation only touches window/DeviceOrientationEvent inside its event handler, so the
// pure heading-offset logic is testable in node. Reset the offset after each test.
afterEach(() => setHeadingOffset(0));

describe("normalizeHeading", () => {
  it("wraps any angle into [0, 360)", () => {
    expect(normalizeHeading(0)).toBe(0);
    expect(normalizeHeading(360)).toBe(0);
    expect(normalizeHeading(370)).toBe(10);
    expect(normalizeHeading(-10)).toBe(350);
    expect(normalizeHeading(-370)).toBe(350);
  });
});

describe("heading offset (compass calibration)", () => {
  it("adds the offset to the reported azimuth, wrapping across 0/360", () => {
    // Default orientation azimuth is 0.
    setHeadingOffset(30);
    expect(getOrientation().azimuth).toBe(30);
    setHeadingOffset(-10);
    expect(getOrientation().azimuth).toBe(350);
  });

  it("round-trips the offset value", () => {
    setHeadingOffset(45);
    expect(getHeadingOffset()).toBe(45);
  });

  it("leaves altitude untouched", () => {
    setHeadingOffset(90);
    expect(getOrientation().altitude).toBe(45); // default tilt, unaffected by heading
  });

  it("defaults to no offset", () => {
    expect(getHeadingOffset()).toBe(0);
    expect(getOrientation().azimuth).toBe(0);
  });
});
