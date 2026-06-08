import { describe, it, expect } from "vitest";
import { parseTLEs, getSatellitePosition, isSatelliteSunlit } from "./satellites";

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

  it("computes topocentric look angles when given an observer", () => {
    const tles = parseTLEs(ISS_TLE_RAW);
    const date = new Date("2024-01-15T12:00:00Z");

    // Without an observer there are no topocentric angles.
    const geocentric = getSatellitePosition(tles[0], date);
    expect(geocentric!.elevationAngle).toBeUndefined();
    expect(geocentric!.azimuth).toBeUndefined();

    // This observer is ~15° from the ISS sub-satellite point, so the ISS sits
    // low on its horizon (~5° elevation). The old geocentric RA/Dec→horizontal
    // path reported ~74° here — a ~70° error — so a low value proves the fix.
    const observer = { latitude: 15, longitude: 167 };
    const topo = getSatellitePosition(tles[0], date, observer);
    expect(topo!.elevationAngle).toBeGreaterThan(-5);
    expect(topo!.elevationAngle).toBeLessThan(30);
    expect(topo!.azimuth).toBeGreaterThanOrEqual(0);
    expect(topo!.azimuth).toBeLessThan(360);
    // RA/Dec are geocentric and must not change when an observer is supplied.
    expect(topo!.ra).toBeCloseTo(geocentric!.ra, 5);
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

describe("isSatelliteSunlit (cylindrical Earth-shadow model)", () => {
  const sun = { x: 1, y: 0, z: 0 }; // Sun toward +x

  it("is lit on the sunward side", () => {
    expect(isSatelliteSunlit({ x: 7000, y: 0, z: 0 }, sun)).toBe(true);
  });

  it("is in shadow when directly behind the Earth (on the anti-sun axis)", () => {
    expect(isSatelliteSunlit({ x: -7000, y: 0, z: 0 }, sun)).toBe(false);
  });

  it("is lit on the anti-sun side if far enough off the shadow axis", () => {
    // 7000 km off-axis is well beyond Earth's radius → out of the umbra.
    expect(isSatelliteSunlit({ x: -7000, y: 7000, z: 0 }, sun)).toBe(true);
  });
});

describe("parseTLEs (3-line CelesTrak format)", () => {
  const TWO = `AAA
1 11111U ...
2 11111 ...
BBB
1 22222U ...
2 22222 ...`;

  it("parses every complete name/line1/line2 triple", () => {
    const tles = parseTLEs(TWO);
    expect(tles).toHaveLength(2);
    expect(tles[0]).toMatchObject({ name: "AAA", line1: "1 11111U ...", line2: "2 11111 ..." });
    expect(tles[1]).toMatchObject({ name: "BBB", line1: "1 22222U ...", line2: "2 22222 ..." });
  });

  it("handles CRLF line endings (trims the trailing \\r)", () => {
    const crlf = "AAA\r\n1 11111U ...\r\n2 11111 ...\r\n";
    const tles = parseTLEs(crlf);
    expect(tles).toHaveLength(1);
    expect(tles[0].name).toBe("AAA");
    expect(tles[0].line2).toBe("2 11111 ...");
  });

  it("drops a trailing incomplete group rather than emitting a partial TLE", () => {
    const partial = `AAA
1 11111U ...
2 11111 ...
BBB
1 22222U ...`; // BBB is missing its line2
    const tles = parseTLEs(partial);
    expect(tles).toHaveLength(1);
    expect(tles[0].name).toBe("AAA");
  });

  it("ignores surrounding blank lines and whitespace", () => {
    const padded = `\n\n  AAA  \n 1 11111U ... \n 2 11111 ... \n\n`;
    const tles = parseTLEs(padded);
    expect(tles).toHaveLength(1);
    expect(tles[0]).toMatchObject({ name: "AAA", line1: "1 11111U ...", line2: "2 11111 ..." });
  });

  it("returns an empty array for empty input", () => {
    expect(parseTLEs("")).toEqual([]);
    expect(parseTLEs("   \n  \n")).toEqual([]);
  });
});