import { describe, it, expect } from "vitest";
import { riseTransitSet, STD_ALT_SUN } from "./riseset";
import { getSunPosition } from "./sun";

const NYC = { latitude: 40.71, longitude: -74.006 };

describe("riseTransitSet", () => {
  it("matches the June-solstice sunrise/sunset for New York (~05:25 / ~20:31 EDT)", () => {
    const date = new Date("2024-06-21T16:00:00Z"); // around local noon
    const sun = getSunPosition(date);
    const r = riseTransitSet(sun.ra, sun.dec, NYC, date, STD_ALT_SUN);

    expect(r.rise).not.toBeNull();
    expect(r.set).not.toBeNull();
    // Sunrise ≈ 09:26 UTC (within ~20 min given the fixed-Dec approximation).
    const riseHr = r.rise!.getUTCHours() + r.rise!.getUTCMinutes() / 60;
    expect(riseHr).toBeGreaterThan(9.1);
    expect(riseHr).toBeLessThan(9.8);
    // Solar transit ≈ 16:58 UTC.
    const transitHr = r.transit!.getUTCHours() + r.transit!.getUTCMinutes() / 60;
    expect(transitHr).toBeGreaterThan(16.7);
    expect(transitHr).toBeLessThan(17.2);
    // Sunset is after transit and a long summer day later.
    expect(r.set!.getTime()).toBeGreaterThan(r.transit!.getTime());
    const dayLengthHr = (r.set!.getTime() - r.rise!.getTime()) / 3600000;
    expect(dayLengthHr).toBeGreaterThan(14.5);
    expect(dayLengthHr).toBeLessThan(15.5);
  });

  it("reports a circumpolar object that never sets", () => {
    const r = riseTransitSet(0, 80, { latitude: 80, longitude: 0 }, new Date("2024-01-15T00:00:00Z"));
    expect(r.circumpolar).toBe(true);
    expect(r.rise).toBeNull();
    expect(r.set).toBeNull();
  });

  it("reports an object that never rises", () => {
    const r = riseTransitSet(0, -80, { latitude: 80, longitude: 0 }, new Date("2024-01-15T00:00:00Z"));
    expect(r.neverRises).toBe(true);
    expect(r.transit).toBeNull();
  });
});
