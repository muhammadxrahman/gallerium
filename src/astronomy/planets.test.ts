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
});