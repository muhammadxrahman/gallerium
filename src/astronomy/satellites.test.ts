import { describe, it, expect } from "vitest";
import { parseTLEs, getSatellitePosition } from "./satellites";

// Real ISS TLE from 2024-01-15 (static for testing)
const ISS_TLE_RAW = `ISS (ZARYA)
1 25544U 98067A   24015.50000000  .00016717  00000-0  10270-3 0  9993
2 25544  51.6412  96.6644 0002988 280.4423  79.6187 15.49572959433729`;

describe("satellites", () => {
  it("parses TLE text into structured objects", () => {
    const tles = parseTLEs(ISS_TLE_RAW);
    expect(tles).toHaveLength(1);
    expect(tles[0].name).toBe("ISS (ZARYA)");
    expect(tles[0].line1).toContain("25544U");
    expect(tles[0].line2).toContain("51.6412");
  });

  it("computes ISS position with valid RA/Dec and realistic altitude", () => {
    const tles = parseTLEs(ISS_TLE_RAW);
    const date = new Date("2024-01-15T12:00:00Z");
    const pos = getSatellitePosition(tles[0], date);

    expect(pos).not.toBeNull();
    expect(pos!.ra).toBeGreaterThanOrEqual(0);
    expect(pos!.ra).toBeLessThan(360);
    expect(pos!.dec).toBeGreaterThan(-90);
    expect(pos!.dec).toBeLessThan(90);
    // ISS orbits between 400-420km
    expect(pos!.altitude).toBeGreaterThan(350);
    expect(pos!.altitude).toBeLessThan(500);
  });

  it("returns null for a corrupted TLE", () => {
    const badTLE = {
      name: "FAKE",
      line1: "not a real tle line",
      line2: "also not real",
    };
    const date = new Date("2024-01-15T12:00:00Z");
    const pos = getSatellitePosition(badTLE, date);
    expect(pos).toBeNull();
  });
});