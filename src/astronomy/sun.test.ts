import { describe, it, expect } from "vitest";
import { getSunPosition } from "./sun";

describe("getSunPosition", () => {
  it("places the Sun correctly for 2024-01-15 (Stellarium: RA ~295.7°, Dec ~-21.1°)", () => {
    const sun = getSunPosition(new Date("2024-01-15T00:00:00Z"));
    expect(sun.ra).toBeGreaterThan(293);
    expect(sun.ra).toBeLessThan(299);
    expect(sun.dec).toBeGreaterThan(-23);
    expect(sun.dec).toBeLessThan(-19);
  });

  it("reaches the northern solstice declination (~+23.4°) in late June", () => {
    const sun = getSunPosition(new Date("2024-06-21T00:00:00Z"));
    expect(sun.dec).toBeGreaterThan(23);
    expect(sun.dec).toBeLessThan(23.5);
  });

  it("sits near the vernal equinox point (RA & Dec ~0) at the March equinox", () => {
    const sun = getSunPosition(new Date("2024-03-20T03:06:00Z"));
    expect(Math.abs(sun.dec)).toBeLessThan(0.5);
    // RA wraps at 360, so accept either end
    expect(sun.ra < 1 || sun.ra > 359).toBe(true);
  });
});
