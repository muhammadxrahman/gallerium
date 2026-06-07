import { describe, it, expect } from "vitest";
import { equatorialToHorizontal } from "./coordinates";
import { getLST } from "./sidereal";

// Betelgeuse: RA 88.7929, Dec 7.4071
// Observer: New York (40.7128N, 74.0060W)
// Time: 2024-01-15 00:00:00 UTC
// Expected from Stellarium: az ~108, alt ~47 (roughly)

describe("equatorialToHorizontal", () => {
  it("places Betelgeuse in the correct region of the sky", () => {
    const date = new Date("2024-01-15T00:00:00Z");
    const observer = { latitude: 40.7128, longitude: -74.006 };
    const lst = getLST(date, observer.longitude);

    const result = equatorialToHorizontal(
      { ra: 88.7929, dec: 7.4071 },
      observer,
      lst
    );

    // Betelgeuse should be in the southeastern sky at this time
    expect(result.alt).toBeGreaterThan(30);
    expect(result.alt).toBeLessThan(70);
    expect(result.az).toBeGreaterThan(90);
    expect(result.az).toBeLessThan(180);
  });

  it("returns negative altitude for a star below the horizon", () => {
    // Observe from North Pole, look at a star with dec -45 — always below horizon
    const date = new Date("2024-01-15T00:00:00Z");
    const observer = { latitude: 90, longitude: 0 };
    const lst = getLST(date, observer.longitude);

    const result = equatorialToHorizontal(
      { ra: 0, dec: -45 },
      observer,
      lst
    );

    expect(result.alt).toBeLessThan(0);
  });
});