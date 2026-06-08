import { describe, it, expect } from "vitest";
import { topocentricCorrection } from "./parallax";

const MOON_DIST = 385000; // km

describe("topocentricCorrection (lunar parallax)", () => {
  it("is a no-op when the body is at the observer's zenith", () => {
    // Zenith ⇒ dec = latitude and hour angle = 0 (ra = LST). No parallax shift.
    const r = topocentricCorrection(100, 20, MOON_DIST, 20, 100);
    expect(r.ra).toBeCloseTo(100, 4);
    expect(r.dec).toBeCloseTo(20, 4);
  });

  it("shifts by ~0.95° (the horizontal parallax) near the horizon", () => {
    // Observer at the equator, body on the horizon (hour angle 90°).
    const r = topocentricCorrection(100, 0, MOON_DIST, 0, 190);
    const shift = Math.hypot(r.ra - 100, r.dec - 0);
    expect(shift).toBeGreaterThan(0.5);
    expect(shift).toBeLessThan(1.05);
  });

  it("shrinks the parallax for a more distant body", () => {
    const near = topocentricCorrection(100, 0, 360000, 0, 190);
    const far = topocentricCorrection(100, 0, 405000, 0, 190);
    expect(Math.abs(near.ra - 100)).toBeGreaterThan(Math.abs(far.ra - 100));
  });
});
