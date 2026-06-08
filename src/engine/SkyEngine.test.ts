import { describe, it, expect, beforeEach } from "vitest";
import { SkyEngine } from "./SkyEngine";
import { EMPTY_SKY } from "./compute";
import { parseTLEs } from "../astronomy/satellites";
import type { Star } from "../data/stars";

const NYC = { latitude: 40.71, longitude: -74.006 };
const NIGHT = new Date("2024-09-15T02:30:00Z"); // Sun well below the horizon over NYC
const DAY = new Date("2024-09-15T16:00:00Z"); // Sun up over NYC
const EPOCH = new Date("2024-01-01T00:00:00Z");

const ISS = parseTLEs(`ISS (ZARYA)
1 25544U 98067A   24015.50000000  .00016717  00000-0  10270-3 0  9993
2 25544  51.6412  96.6644 0002988 280.4423  79.6187 15.49572959433729`);

function star(id: number, ra: number, dec: number, name?: string): Star {
  return { id, ra, dec, magnitude: 2, colorIndex: 0, name };
}

const CATALOG = [star(1, 100, 20, "Vega"), star(2, 50, 10, '""'), star(3, 200, -10, undefined)];

describe("SkyEngine", () => {
  let engine: SkyEngine;

  beforeEach(() => {
    engine = new SkyEngine();
  });

  describe("initial state", () => {
    it("starts empty — no observer, catalog, or TLEs", () => {
      expect(engine.observer).toBeNull();
      expect(engine.hasStars()).toBe(false);
      expect(engine.hasTles()).toBe(false);
      expect(engine.bodies).toBe(EMPTY_SKY);
      expect(engine.satellites).toEqual([]);
      expect(engine.search.items).toEqual([]);
      expect(engine.search.meta.size).toBe(0);
    });
  });

  describe("setCatalog", () => {
    it("marks stars present and builds a search index of named objects only", () => {
      engine.setCatalog(CATALOG, EPOCH);
      expect(engine.hasStars()).toBe(true);
      const labels = engine.search.items.map((i) => i.label);
      // Sun/Moon/5 planets are always present.
      expect(labels).toContain("Sun");
      expect(labels).toContain("Moon");
      expect(labels).toContain("Jupiter");
      // Named star in, unnamed / quoted-empty out.
      expect(labels).toContain("Vega");
      expect(labels).not.toContain('""');
      expect(engine.search.items.filter((i) => i.id.startsWith("star:"))).toHaveLength(1);
    });

    it("reloading the catalog rebuilds (does not accumulate) the search index", () => {
      engine.setCatalog(CATALOG, EPOCH);
      const firstCount = engine.search.items.length;
      engine.setCatalog([star(9, 10, 10, "Sirius")], EPOCH);
      const labels = engine.search.items.map((i) => i.label);
      expect(labels).toContain("Sirius");
      expect(labels).not.toContain("Vega");
      // Same fixed entries (Sun/Moon/planets/constellations) + 1 named star both times.
      expect(engine.search.items.length).toBe(firstCount);
    });
  });

  describe("setTles / hasTles", () => {
    it("tracks loaded TLEs", () => {
      expect(engine.hasTles()).toBe(false);
      engine.setTles(ISS);
      expect(engine.hasTles()).toBe(true);
      expect(engine.tles).toBe(ISS);
    });
  });

  describe("recomputeBodies", () => {
    it("is a no-op without an observer (bodies stay EMPTY_SKY)", () => {
      engine.setCatalog(CATALOG, EPOCH);
      engine.recomputeBodies(NIGHT);
      expect(engine.bodies).toBe(EMPTY_SKY);
    });

    it("populates positioned bodies for the named + unnamed catalog once an observer is set", () => {
      engine.setCatalog(CATALOG, EPOCH);
      engine.observer = NYC;
      engine.recomputeBodies(NIGHT);
      // All three catalog stars are positioned (unnamed ones still render).
      expect(engine.bodies.stars).toHaveLength(3);
      expect(engine.bodies.stars[0]).toHaveProperty("alt");
      expect(engine.bodies.stars[0]).toHaveProperty("az");
      expect(engine.bodies.planets).toHaveLength(5);
      expect(engine.bodies.moon).not.toBeNull();
      expect(engine.bodies.sun).not.toBeNull();
      expect(engine.bodies.lst).toBeGreaterThanOrEqual(0);
      expect(engine.bodies.lst).toBeLessThan(360);
    });

    it("uses the precessed catalog (works with an empty catalog too)", () => {
      engine.observer = NYC;
      engine.recomputeBodies(NIGHT);
      expect(engine.bodies.stars).toEqual([]);
      expect(engine.bodies.sun).not.toBeNull();
    });
  });

  describe("recomputeSatellites", () => {
    it("is a no-op without an observer", () => {
      engine.setTles(ISS);
      engine.recomputeSatellites(NIGHT);
      expect(engine.satellites).toEqual([]);
    });

    it("shows no satellites while the Sun is up", () => {
      engine.setCatalog([], EPOCH);
      engine.setTles(ISS);
      engine.observer = NYC;
      engine.recomputeBodies(DAY);
      engine.recomputeSatellites(DAY);
      expect(engine.satellites).toEqual([]);
    });

    it("returns only sunlit satellites with a numeric altitude when the observer is dark", () => {
      engine.setCatalog([], EPOCH);
      engine.setTles(ISS);
      engine.observer = NYC;
      engine.recomputeBodies(NIGHT);
      engine.recomputeSatellites(NIGHT);
      for (const s of engine.satellites) {
        expect(s.sunlit).toBe(true);
        expect(typeof s.alt).toBe("number");
        expect(typeof s.az).toBe("number");
      }
    });

    it("depends on the Sun from the latest recomputeBodies — stale empty sky shows nothing", () => {
      engine.setTles(ISS);
      engine.observer = NYC;
      // No recomputeBodies → bodies.sun is null → guarded to empty.
      engine.recomputeSatellites(NIGHT);
      expect(engine.satellites).toEqual([]);
    });
  });

  describe("highlights", () => {
    it("returns an empty feed without an observer", () => {
      engine.setCatalog(CATALOG, EPOCH);
      expect(engine.highlights(NIGHT)).toEqual([]);
    });

    it("returns a feed once observer + bodies are computed", () => {
      engine.setCatalog([], EPOCH);
      engine.observer = NYC;
      engine.recomputeBodies(NIGHT);
      const feed = engine.highlights(NIGHT);
      expect(feed.length).toBeGreaterThan(0);
      for (const item of feed) {
        expect(typeof item.text).toBe("string");
        expect(item.icon).toContain("<svg");
      }
    });
  });

  describe("full lifecycle", () => {
    it("load → locate → compute → read mirrors the render loop", () => {
      engine.setCatalog(CATALOG, EPOCH);
      engine.setTles(ISS);
      engine.observer = NYC;
      engine.recomputeBodies(NIGHT);
      engine.recomputeSatellites(NIGHT);
      expect(engine.bodies.stars.length).toBe(3);
      expect(engine.bodies.sun!.alt).toBeLessThan(0); // night
      expect(engine.highlights(NIGHT).length).toBeGreaterThan(0);
    });
  });
});
