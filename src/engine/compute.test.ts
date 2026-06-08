import { describe, it, expect } from "vitest";
import {
  precessCatalog,
  precessDeepSky,
  toApparentHorizontal,
  computeBodies,
  computeSatellites,
} from "./compute";
import { parseTLEs } from "../astronomy/satellites";
import { equatorialToHorizontal } from "../astronomy/coordinates";
import { getLST } from "../astronomy/sidereal";
import type { Star } from "../data/stars";
import type { DeepSkyObject } from "../data/deepSky";

const NYC = { latitude: 40.71, longitude: -74.006 };
const DATE = new Date("2024-09-15T02:30:00Z"); // night over NYC

const ISS = parseTLEs(`ISS (ZARYA)
1 25544U 98067A   24015.50000000  .00016717  00000-0  10270-3 0  9993
2 25544  51.6412  96.6644 0002988 280.4423  79.6187 15.49572959433729`);

function star(id: number, ra: number, dec: number, name?: string): Star {
  return { id, ra, dec, magnitude: 2, colorIndex: 0, name };
}

describe("precessCatalog", () => {
  it("precesses positions to epoch and sanitizes quoted-empty names", () => {
    const out = precessCatalog([star(1, 100, 20, '""'), star(2, 100, 20, "Vega")], new Date("2050-01-01T12:00:00Z"));
    expect(out[0].name).toBeUndefined(); // '""' → unnamed
    expect(out[1].name).toBe("Vega");
    // Precession moves the J2000 position by a fraction of a degree by 2050.
    const moved = Math.hypot(out[0].ra - 100, out[0].dec - 20);
    expect(moved).toBeGreaterThan(0.3);
    expect(moved).toBeLessThan(1);
  });
});

describe("toApparentHorizontal", () => {
  it("applies refraction — apparent altitude is at or above geometric", () => {
    const lst = getLST(DATE, NYC.longitude);
    // A star near the horizon: refraction should lift it noticeably.
    const geom = equatorialToHorizontal({ ra: lst + 89, dec: NYC.latitude - 89 }, NYC, lst);
    const app = toApparentHorizontal(lst + 89, NYC.latitude - 89, NYC, lst);
    expect(app.alt).toBeGreaterThanOrEqual(geom.alt);
    expect(app.az).toBeCloseTo(geom.az, 6); // refraction doesn't change azimuth
  });
});

describe("computeBodies", () => {
  const dso: DeepSkyObject[] = [
    { id: "M42", name: "Orion Nebula", ra: 83.82, dec: -5.39, magnitude: 4, kind: "nebula" },
  ];
  const sky = computeBodies([star(1, 100, 20, "Test")], NYC, DATE, dso);

  it("returns positioned bodies with an LST", () => {
    expect(sky.stars).toHaveLength(1);
    expect(sky.stars[0]).toHaveProperty("alt");
    expect(sky.stars[0]).toHaveProperty("az");
    expect(sky.planets).toHaveLength(7); // 5 naked-eye + Uranus + Neptune
    expect(sky.moon).not.toBeNull();
    expect(sky.sun).not.toBeNull();
    expect(sky.lst).toBeGreaterThanOrEqual(0);
    expect(sky.lst).toBeLessThan(360);
  });

  it("positions deep-sky objects through the same horizontal pipeline as stars", () => {
    expect(sky.deepSky).toHaveLength(1);
    expect(sky.deepSky[0].id).toBe("M42");
    expect(sky.deepSky[0]).toHaveProperty("alt");
    expect(sky.deepSky[0]).toHaveProperty("az");
  });

  it("defaults deep-sky to empty when none are supplied", () => {
    expect(computeBodies([], NYC, DATE).deepSky).toEqual([]);
  });

  it("puts the Sun below the horizon at local night", () => {
    expect(sky.sun!.alt).toBeLessThan(0);
  });
});

describe("precessDeepSky", () => {
  it("precesses J2000 positions to the target epoch", () => {
    const [out] = precessDeepSky(
      [{ id: "M42", name: "Orion Nebula", ra: 83.82, dec: -5.39, magnitude: 4, kind: "nebula" }],
      new Date("2050-01-01T12:00:00Z")
    );
    const moved = Math.hypot(out.ra - 83.82, out.dec - -5.39);
    expect(moved).toBeGreaterThan(0.2); // precession shifts it by a fraction of a degree
    expect(moved).toBeLessThan(1);
    expect(out.id).toBe("M42"); // identity preserved
    expect(out.kind).toBe("nebula");
  });
});

describe("computeSatellites", () => {
  const lst = getLST(DATE, NYC.longitude);
  const sky = computeBodies([], NYC, DATE);

  it("shows nothing while the Sun is up (daytime / bright twilight)", () => {
    const daySun = { ra: 0, dec: 0, az: 180, alt: 30 };
    expect(computeSatellites(ISS, NYC, daySun, DATE)).toEqual([]);
  });

  it("shows nothing when there is no Sun position", () => {
    expect(computeSatellites(ISS, NYC, null, DATE)).toEqual([]);
  });

  it("only returns sunlit satellites when the observer is dark", () => {
    void lst;
    const sats = computeSatellites(ISS, NYC, sky.sun, DATE); // Sun is below −6° here
    for (const s of sats) {
      expect(s.sunlit).toBe(true);
      expect(typeof s.alt).toBe("number");
    }
  });
});
