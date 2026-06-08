import { describe, it, expect } from "vitest";
import { predictPasses } from "./passes";
import { parseTLEs } from "./satellites";

const ISS = parseTLEs(`ISS (ZARYA)
1 25544U 98067A   24015.50000000  .00016717  00000-0  10270-3 0  9993
2 25544  51.6412  96.6644 0002988 280.4423  79.6187 15.49572959433729`)[0];

const NYC = { latitude: 40.71, longitude: -74.006 };
const from = new Date("2024-01-15T00:00:00Z");

describe("predictPasses", () => {
  it("finds above-horizon ISS passes over New York within a day (geometry)", () => {
    const passes = predictPasses(ISS, NYC, from, { hours: 24, visibleOnly: false, minElevation: 10 });
    expect(passes.length).toBeGreaterThan(0);
  });

  it("returns well-formed, time-ordered passes", () => {
    const passes = predictPasses(ISS, NYC, from, { hours: 24, visibleOnly: false, minElevation: 10 });
    for (const p of passes) {
      expect(p.start.getTime()).toBeLessThanOrEqual(p.peakTime.getTime());
      expect(p.peakTime.getTime()).toBeLessThanOrEqual(p.end.getTime());
      expect(p.peakElevation).toBeGreaterThan(10);
      expect(p.peakElevation).toBeLessThanOrEqual(90);
      expect(p.startAz).toBeGreaterThanOrEqual(0);
      expect(p.startAz).toBeLessThan(360);
    }
    // passes are returned in chronological order
    for (let i = 1; i < passes.length; i++) {
      expect(passes[i].start.getTime()).toBeGreaterThan(passes[i - 1].end.getTime());
    }
  });

  it("visible passes are a subset of geometric passes", () => {
    const geometric = predictPasses(ISS, NYC, from, { hours: 48, visibleOnly: false });
    const visible = predictPasses(ISS, NYC, from, { hours: 48, visibleOnly: true });
    expect(visible.length).toBeLessThanOrEqual(geometric.length);
  });
});
