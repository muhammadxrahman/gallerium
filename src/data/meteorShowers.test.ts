import { describe, it, expect } from "vitest";
import { METEOR_SHOWERS } from "./meteorShowers";

describe("METEOR_SHOWERS catalog", () => {
  it("lists the major annual showers", () => {
    const names = METEOR_SHOWERS.map((s) => s.name);
    for (const n of ["Quadrantids", "Lyrids", "Perseids", "Orionids", "Leonids", "Geminids"]) {
      expect(names).toContain(n);
    }
  });

  it("has unique names", () => {
    const names = METEOR_SHOWERS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has valid radiants, solar longitudes in range, and positive ZHR", () => {
    for (const s of METEOR_SHOWERS) {
      expect(s.radiantRA).toBeGreaterThanOrEqual(0);
      expect(s.radiantRA).toBeLessThan(360);
      expect(s.radiantDec).toBeGreaterThanOrEqual(-90);
      expect(s.radiantDec).toBeLessThanOrEqual(90);
      for (const lon of [s.peakLon, s.startLon, s.endLon]) {
        expect(lon).toBeGreaterThanOrEqual(0);
        expect(lon).toBeLessThan(360);
      }
      expect(s.zhr).toBeGreaterThan(0);
      expect(s.parent.length).toBeGreaterThan(0);
    }
  });

  it("each active window contains its own peak", () => {
    for (const s of METEOR_SHOWERS) {
      expect(s.peakLon).toBeGreaterThanOrEqual(s.startLon);
      expect(s.peakLon).toBeLessThanOrEqual(s.endLon);
    }
  });
});
