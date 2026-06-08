import { describe, it, expect } from "vitest";
import { buildSearchIndex, targetLabel, targetAltAz, targetSelection } from "./search";
import { computeBodies } from "./compute";
import type { Star } from "../data/stars";
import type { DeepSkyObject } from "../data/deepSky";

const NYC = { latitude: 40.71, longitude: -74.006 };
const DATE = new Date("2024-09-15T02:30:00Z");

function star(id: number, ra: number, dec: number, name?: string): Star {
  return { id, ra, dec, magnitude: 2, colorIndex: 0, name };
}

const cats = [{ n: "Orion", ra: 83, dec: 0 }];
const dsos: DeepSkyObject[] = [
  { id: "M31", name: "Andromeda Galaxy", ra: 10.68, dec: 41.27, magnitude: 3.4, kind: "galaxy" },
];

describe("buildSearchIndex", () => {
  const { items, meta } = buildSearchIndex(
    [star(1, 100, 20, "Vega"), star(2, 50, 10, '""'), star(3, 30, 5, undefined)],
    cats,
    dsos
  );
  const labels = items.map((i) => i.label);

  it("includes Sun, Moon, all 7 planets, named stars, deep-sky and constellations", () => {
    expect(labels).toContain("Sun");
    expect(labels).toContain("Moon");
    expect(labels).toContain("Saturn");
    expect(labels).toContain("Neptune"); // outer planet
    expect(labels).toContain("Vega");
    expect(labels).toContain("Orion");
    expect(labels).toContain("Andromeda Galaxy (M31)"); // deep-sky, searchable by name + id
  });

  it("tags the deep-sky entry with its kind and a resolvable meta", () => {
    const m31 = items.find((i) => i.id === "deepsky:M31");
    expect(m31?.sublabel).toBe("Galaxy");
    expect(meta.get("deepsky:M31")).toEqual({ kind: "deepsky", id: "M31", label: "Andromeda Galaxy (M31)" });
  });

  it("excludes unnamed / quoted-empty stars from results", () => {
    expect(labels).not.toContain('""');
    expect(labels).not.toContain("");
    // only one star (Vega) made it in
    expect(items.filter((i) => i.id.startsWith("star:"))).toHaveLength(1);
    expect(meta.get("planet:Mars")).toEqual({ kind: "planet", name: "Mars" });
  });
});

describe("targetAltAz / targetSelection / targetLabel", () => {
  const sky = computeBodies([star(7, 100, 20, "Vega")], NYC, DATE, dsos);

  it("resolves every target kind against the computed sky", () => {
    expect(targetAltAz({ kind: "sun" }, sky, NYC)).not.toBeNull();
    expect(targetAltAz({ kind: "moon" }, sky, NYC)).not.toBeNull();
    expect(targetAltAz({ kind: "planet", name: "Jupiter" }, sky, NYC)).not.toBeNull();
    expect(targetAltAz({ kind: "planet", name: "Neptune" }, sky, NYC)).not.toBeNull();
    expect(targetAltAz({ kind: "star", id: 7, label: "Vega" }, sky, NYC)).not.toBeNull();
    expect(targetAltAz({ kind: "deepsky", id: "M31", label: "Andromeda Galaxy (M31)" }, sky, NYC)).not.toBeNull();
    expect(targetAltAz({ kind: "con", label: "Orion", ra: 83, dec: 0 }, sky, NYC)).not.toBeNull();
  });

  it("returns null for a planet/star/deep-sky not present", () => {
    expect(targetAltAz({ kind: "star", id: 999, label: "x" }, sky, NYC)).toBeNull();
    expect(targetAltAz({ kind: "deepsky", id: "M999", label: "x" }, sky, NYC)).toBeNull();
  });

  it("maps targets to the right selection type (constellations have no card)", () => {
    expect(targetSelection({ kind: "sun" }, sky)?.type).toBe("sun");
    expect(targetSelection({ kind: "star", id: 7, label: "Vega" }, sky)?.type).toBe("star");
    expect(targetSelection({ kind: "deepsky", id: "M31", label: "Andromeda Galaxy (M31)" }, sky)?.type).toBe("deepsky");
    expect(targetSelection({ kind: "con", label: "Orion", ra: 83, dec: 0 }, sky)).toBeNull();
  });

  it("labels targets readably", () => {
    expect(targetLabel({ kind: "planet", name: "Mars" })).toBe("Mars");
    expect(targetLabel({ kind: "con", label: "Lyra", ra: 0, dec: 0 })).toBe("Lyra");
    expect(targetLabel({ kind: "sun" })).toBe("Sun");
  });
});
