import { describe, it, expect } from "vitest";
import { parseCSV } from "./stars";

// Minimal HYG-shaped CSV (quoted headers, RA in hours) with the Sun row (id 0)
// plus two real stars and one too-faint star.
const CSV = `"id","ra","dec","mag","ci","proper"
0,0.000000,0.000000,-26.7,0.656,Sol
32349,6.752481,-16.716116,-1.44,0.0,Sirius
11767,2.529750,89.264109,1.97,0.6,Polaris
99999,12.000000,10.000000,9.5,0.5,FaintStar`;

describe("parseCSV", () => {
  const stars = parseCSV(CSV);

  it("excludes the Sun (HYG id 0 / Sol) — it is computed, not a fixed star", () => {
    expect(stars.find((s) => s.id === 0)).toBeUndefined();
    expect(stars.find((s) => s.name === "Sol")).toBeUndefined();
  });

  it("drops stars fainter than the naked-eye limit", () => {
    expect(stars.find((s) => s.name === "FaintStar")).toBeUndefined();
  });

  it("keeps real stars and converts RA from hours to degrees", () => {
    const sirius = stars.find((s) => s.name === "Sirius")!;
    expect(sirius).toBeDefined();
    expect(sirius.ra).toBeCloseTo(6.752481 * 15, 4); // ~101.3°
    expect(sirius.dec).toBeCloseTo(-16.716116, 4);
    expect(sirius.magnitude).toBe(-1.44);
  });
});
