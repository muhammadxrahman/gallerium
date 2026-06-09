import { describe, it, expect } from "vitest";
import { getSunPosition } from "./sun";
import { getMoonPosition } from "./moon";
import { getPlanetPosition } from "./planets";

// Ground-truth accuracy suite. This is the "turn should-be-accurate into proof" layer:
// it pins the models against references that are independently verifiable (the Sun's
// declination at the equinoxes/solstices is definitional), against physical invariants
// (the Sun lies on the ecliptic; the Moon stays within its orbital inclination and its
// perigee/apogee distance bounds), and against a few JPL Horizons planet positions with
// tolerances that reflect each model's documented precision.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const OBLIQUITY = 23.4393; // mean obliquity, good enough for an on-the-ecliptic check

// Ecliptic latitude from equatorial coordinates (degrees).
function eclipticLatitude(raDeg: number, decDeg: number): number {
  const ra = raDeg * D2R;
  const dec = decDeg * D2R;
  const eps = OBLIQUITY * D2R;
  return Math.asin(Math.sin(dec) * Math.cos(eps) - Math.cos(dec) * Math.sin(eps) * Math.sin(ra)) * R2D;
}

// Great-circle angular separation between two equatorial points (degrees).
function angularSep(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const c =
    Math.sin(dec1 * D2R) * Math.sin(dec2 * D2R) +
    Math.cos(dec1 * D2R) * Math.cos(dec2 * D2R) * Math.cos((ra1 - ra2) * D2R);
  return Math.acos(Math.max(-1, Math.min(1, c))) * R2D;
}

// Shortest distance from an RA to a target RA, across the 0/360 wrap (degrees).
function raDistance(ra: number, target: number): number {
  const d = Math.abs(((ra - target + 540) % 360) - 180);
  return d;
}

describe("Sun — equinox/solstice ground truth (2025)", () => {
  // The Sun's declination is 0 at the equinoxes and ±obliquity at the solstices, by
  // definition. Instants are UTC to the minute; the Sun's declination changes slowly
  // enough near these points that minute-level timing is negligible.
  it("March equinox: Dec ≈ 0, RA ≈ 0", () => {
    const s = getSunPosition(new Date("2025-03-20T09:01:00Z"));
    expect(Math.abs(s.dec)).toBeLessThan(0.1);
    expect(raDistance(s.ra, 0)).toBeLessThan(0.3);
  });

  it("June solstice: Dec ≈ +23.44, RA ≈ 90", () => {
    const s = getSunPosition(new Date("2025-06-21T02:42:00Z"));
    expect(s.dec).toBeGreaterThan(23.3);
    expect(s.dec).toBeLessThan(23.5);
    expect(raDistance(s.ra, 90)).toBeLessThan(0.5);
  });

  it("September equinox: Dec ≈ 0, RA ≈ 180", () => {
    const s = getSunPosition(new Date("2025-09-22T18:19:00Z"));
    expect(Math.abs(s.dec)).toBeLessThan(0.1);
    expect(raDistance(s.ra, 180)).toBeLessThan(0.3);
  });

  it("December solstice: Dec ≈ -23.44, RA ≈ 270", () => {
    const s = getSunPosition(new Date("2025-12-21T15:03:00Z"));
    expect(s.dec).toBeGreaterThan(-23.5);
    expect(s.dec).toBeLessThan(-23.3);
    expect(raDistance(s.ra, 270)).toBeLessThan(0.5);
  });
});

describe("Sun — lies on the ecliptic (invariant)", () => {
  it("ecliptic latitude stays ~0 all year", () => {
    for (let month = 0; month < 12; month++) {
      const d = new Date(Date.UTC(2025, month, 15, 12, 0, 0));
      const s = getSunPosition(d);
      expect(Math.abs(eclipticLatitude(s.ra, s.dec))).toBeLessThan(0.02);
    }
  });
});

describe("Moon — physical invariants across a year", () => {
  // Sampled every ~15 days through 2025.
  const dates: Date[] = [];
  for (let day = 0; day < 365; day += 15) {
    dates.push(new Date(Date.UTC(2025, 0, 1 + day, 0, 0, 0)));
  }

  it("never strays beyond its orbital inclination (~5.3°) from the ecliptic", () => {
    for (const d of dates) {
      const m = getMoonPosition(d);
      expect(Math.abs(eclipticLatitude(m.ra, m.dec))).toBeLessThan(5.6);
    }
  });

  it("stays within plausible perigee–apogee distance bounds", () => {
    for (const d of dates) {
      const m = getMoonPosition(d);
      expect(m.distanceKm).toBeGreaterThan(350_000); // perigee ~356,500 km
      expect(m.distanceKm).toBeLessThan(410_000); // apogee ~406,700 km
    }
  });
});

describe("Planets — JPL Horizons cross-checks (documented tolerances)", () => {
  // Geocentric positions from JPL Horizons. The low-precision Keplerian elements are
  // accurate to ~1° near J2000 and drift further out, so a 3° tolerance is the honest
  // bound (this is a visual app — "correct region of the sky", not navigation).
  const TOL = 3;
  const cases: Array<{ name: string; date: string; ra: number; dec: number }> = [
    { name: "Jupiter", date: "2024-01-15T00:00:00Z", ra: 35.6, dec: 14.6 },
    { name: "Mars", date: "2024-12-01T00:00:00Z", ra: 128.0, dec: 22.0 },
    { name: "Uranus", date: "2024-01-01T00:00:00Z", ra: 48.5, dec: 17.9 },
    { name: "Neptune", date: "2024-01-01T00:00:00Z", ra: 357.6, dec: -2.5 },
  ];

  for (const c of cases) {
    it(`${c.name} on ${c.date.slice(0, 10)} within ${TOL}° of JPL`, () => {
      const p = getPlanetPosition(c.name, new Date(c.date));
      expect(angularSep(p.ra, p.dec, c.ra, c.dec)).toBeLessThan(TOL);
    });
  }
});
