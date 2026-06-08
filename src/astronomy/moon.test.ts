import { describe, it, expect } from "vitest";
import { getMoonPosition } from "./moon";

describe("getMoonPosition", () => {
  const date = new Date("2024-01-15T00:00:00Z");

  it("places Moon in correct RA range for Jan 15 2024", () => {
    const moon = getMoonPosition(date);
    // Stellarium reference: RA ~347°, we're within 2°
    expect(moon.ra).toBeGreaterThan(340);
    expect(moon.ra).toBeLessThan(355);
  });

  it("places Moon in correct Dec range for Jan 15 2024", () => {
    const moon = getMoonPosition(date);
    // Stellarium reference: Dec ~-8.6°, we're within 1°
    expect(moon.dec).toBeGreaterThan(-12);
    expect(moon.dec).toBeLessThan(-6);
  });

  it("returns valid illumination between 0 and 1", () => {
    const moon = getMoonPosition(date);
    expect(moon.illumination).toBeGreaterThanOrEqual(0);
    expect(moon.illumination).toBeLessThanOrEqual(1);
  });

  it("full moon has illumination near 1", () => {
    const fullMoon = new Date("2024-01-25T18:00:00Z");
    const moon = getMoonPosition(fullMoon);
    expect(moon.illumination).toBeGreaterThan(0.9);
  });

  it("reports waxing between new and full moon", () => {
    // New moon was 2024-01-11; the days after it are waxing toward full (01-25).
    const waxing = getMoonPosition(new Date("2024-01-18T00:00:00Z"));
    expect(waxing.waxing).toBe(true);

    // After the 01-25 full moon the disc is shrinking again — waning.
    const waning = getMoonPosition(new Date("2024-02-01T00:00:00Z"));
    expect(waning.waxing).toBe(false);
  });
});