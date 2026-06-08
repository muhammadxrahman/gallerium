import { describe, it, expect } from "vitest";
import { getPlanetPosition, getAllPlanets } from "./planets";

// Cross-check against JPL Horizons for 2024-01-15 00:00 UTC
// Jupiter: RA ~35.5°, Dec ~14.8°
// Mars:    RA ~267°,  Dec ~-24° (roughly)

describe("getPlanetPosition", () => {
  const date = new Date("2024-01-15T00:00:00Z");

  it("places Jupiter in Aries region (RA ~20-50, Dec ~10-20)", () => {
    const jupiter = getPlanetPosition("Jupiter", date);
    expect(jupiter.ra).toBeGreaterThan(20);
    expect(jupiter.ra).toBeLessThan(50);
    expect(jupiter.dec).toBeGreaterThan(10);
    expect(jupiter.dec).toBeLessThan(20);
  });

  it("places Mars in Ophiuchus/Sagittarius region (RA ~250-280, Dec negative)", () => {
    const mars = getPlanetPosition("Mars", date);
    expect(mars.ra).toBeGreaterThan(250);
    expect(mars.ra).toBeLessThan(285);
    expect(mars.dec).toBeLessThan(0);
  });

  it("returns all 5 planets", () => {
    const planets = getAllPlanets(date);
    expect(planets).toHaveLength(5);
  });

  it("computes realistic apparent magnitudes (Venus brightest, ~-4)", () => {
    const venus = getPlanetPosition("Venus", date);
    const jupiter = getPlanetPosition("Jupiter", date);
    const mars = getPlanetPosition("Mars", date);
    // 2024-01-15 reference (Stellarium): Venus ~-4.0, Jupiter ~-2.5, Mars ~+1.4
    expect(venus.magnitude).toBeGreaterThan(-4.5);
    expect(venus.magnitude).toBeLessThan(-3.5);
    expect(jupiter.magnitude).toBeGreaterThan(-3);
    expect(jupiter.magnitude).toBeLessThan(-2);
    expect(mars.magnitude).toBeGreaterThan(0.5);
    expect(mars.magnitude).toBeLessThan(2);
    // Venus is brighter (lower magnitude) than Jupiter than Mars.
    expect(venus.magnitude).toBeLessThan(jupiter.magnitude);
    expect(jupiter.magnitude).toBeLessThan(mars.magnitude);
  });

  it("reports an illuminated fraction between 0 and 1", () => {
    for (const p of getAllPlanets(date)) {
      expect(p.phase).toBeGreaterThanOrEqual(0);
      expect(p.phase).toBeLessThanOrEqual(1);
    }
  });

  // Regression guard for the Kepler-equation solver. On 2024-12-01 Mars is in
  // Cancer at RA ~128°, Dec ~+22° (JPL Horizons). A solver that mixes degrees
  // with the radian-valued e*sin(E) term lands near RA ~120° — ~8° off — so this
  // range passes only when eccentricity is handled correctly.
  it("solves eccentricity correctly: Mars near RA 128° on 2024-12-01", () => {
    const mars = getPlanetPosition("Mars", new Date("2024-12-01T00:00:00Z"));
    expect(mars.ra).toBeGreaterThan(125);
    expect(mars.ra).toBeLessThan(132);
    expect(mars.dec).toBeGreaterThan(18);
    expect(mars.dec).toBeLessThan(24);
  });
});