import { describe, it, expect } from "vitest";
import { parseCSV, cleanProperName } from "./stars";

describe("cleanProperName", () => {
  it("collapses HYG quoted-empty names to undefined", () => {
    expect(cleanProperName('""')).toBeUndefined(); // the exact cached bad value
    expect(cleanProperName('"  "')).toBeUndefined();
    expect(cleanProperName("   ")).toBeUndefined();
    expect(cleanProperName("")).toBeUndefined();
    expect(cleanProperName(undefined)).toBeUndefined();
  });

  it("keeps real names (including quoted multi-word ones)", () => {
    expect(cleanProperName("Polaris")).toBe("Polaris");
    expect(cleanProperName('"Rigil Kentaurus"')).toBe("Rigil Kentaurus");
  });
});

// Minimal HYG-shaped CSV (quoted headers, RA in hours) with the Sun row (id 0),
// real named stars, an UNNAMED star whose proper is the quoted-empty `""` (exactly
// how HYG stores it), and one too-faint star.
const CSV = `"id","ra","dec","mag","ci","proper"
0,0.000000,0.000000,-26.7,0.656,Sol
32349,6.752481,-16.716116,-1.44,0.0,Sirius
11767,2.529750,89.264109,1.97,0.6,Polaris
1,0.000060,1.089009,2.39,0.482,""
99999,12.000000,10.000000,9.5,0.5,FaintStar`;

describe("parseCSV", () => {
  const stars = parseCSV(CSV);

  it("excludes the Sun (HYG id 0 / Sol) — it is computed, not a fixed star", () => {
    expect(stars.find((s) => s.id === 0)).toBeUndefined();
    expect(stars.find((s) => s.name === "Sol")).toBeUndefined();
  });

  it("treats a quoted-empty proper name as unnamed (no stray \"\" labels)", () => {
    const unnamed = stars.find((s) => s.id === 1)!;
    expect(unnamed).toBeDefined(); // it's still a real star to plot
    expect(unnamed.name).toBeUndefined(); // but it has no name
    // No parsed star should carry an empty/quote-only name.
    expect(stars.every((s) => s.name === undefined || s.name.replace(/"/g, "").trim().length > 0)).toBe(true);
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
