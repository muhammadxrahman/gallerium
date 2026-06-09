import { describe, it, expect } from "vitest";
import { altitudeTrack, sunAltitudeTrack } from "./altitudeTrack";

const START = new Date("2024-06-21T00:00:00Z");
const NYC = { latitude: 40, longitude: -74 };

describe("altitudeTrack", () => {
  it("returns steps+1 evenly spaced samples", () => {
    const t = altitudeTrack(0, 0, NYC, START, 24, 60);
    expect(t).toHaveLength(25);
    expect(t[1].t.getTime() - t[0].t.getTime()).toBe(60 * 60_000);
  });

  it("keeps a circumpolar star up all day (dec > 90 − lat)", () => {
    const t = altitudeTrack(123, 80, { latitude: 60, longitude: 0 }, START, 24, 30);
    expect(t.every((s) => s.alt > 0)).toBe(true);
  });

  it("never raises a star from the far hemisphere", () => {
    const t = altitudeTrack(123, -80, { latitude: 60, longitude: 0 }, START, 24, 30);
    expect(t.every((s) => s.alt < 0)).toBe(true);
  });

  it("peaks within a couple degrees of the zenith when dec ≈ latitude", () => {
    const t = altitudeTrack(50, 40, NYC, START, 24, 10);
    const max = Math.max(...t.map((s) => s.alt));
    expect(max).toBeGreaterThan(88);
    expect(max).toBeLessThanOrEqual(90.001);
  });

  it("an equatorial star both rises and sets (altitude crosses 0)", () => {
    const t = altitudeTrack(50, 0, NYC, START, 24, 30);
    expect(Math.min(...t.map((s) => s.alt))).toBeLessThan(0);
    expect(Math.max(...t.map((s) => s.alt))).toBeGreaterThan(0);
  });
});

describe("sunAltitudeTrack", () => {
  it("spans both daylight and night over 24h", () => {
    const t = sunAltitudeTrack(NYC, START, 24, 30);
    expect(Math.max(...t.map((s) => s.alt))).toBeGreaterThan(0); // daytime
    expect(Math.min(...t.map((s) => s.alt))).toBeLessThan(0); // night
  });
});
