import { describe, it, expect } from "vitest";
import { DEEP_SKY, DEEP_SKY_KIND_LABEL, type DeepSkyKind } from "./deepSky";

const KINDS: DeepSkyKind[] = [
  "galaxy",
  "open-cluster",
  "globular-cluster",
  "nebula",
  "planetary-nebula",
  "supernova-remnant",
];

describe("DEEP_SKY catalog integrity", () => {
  it("is non-empty", () => {
    expect(DEEP_SKY.length).toBeGreaterThan(20);
  });

  it("has unique catalog ids", () => {
    const ids = DEEP_SKY.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has valid J2000 coordinates and finite magnitudes", () => {
    for (const o of DEEP_SKY) {
      expect(o.ra).toBeGreaterThanOrEqual(0);
      expect(o.ra).toBeLessThan(360);
      expect(o.dec).toBeGreaterThanOrEqual(-90);
      expect(o.dec).toBeLessThanOrEqual(90);
      expect(Number.isFinite(o.magnitude)).toBe(true);
      expect(o.name.length).toBeGreaterThan(0);
    }
  });

  it("uses only known kinds, each with a human label", () => {
    for (const o of DEEP_SKY) {
      expect(KINDS).toContain(o.kind);
      expect(DEEP_SKY_KIND_LABEL[o.kind]).toBeTruthy();
    }
  });

  it("includes well-known showpiece objects at the right positions", () => {
    const byId = new Map(DEEP_SKY.map((o) => [o.id, o]));
    // M31 Andromeda ~ RA 10.7°, Dec +41.3°
    expect(byId.get("M31")!.ra).toBeCloseTo(10.68, 1);
    expect(byId.get("M31")!.dec).toBeCloseTo(41.27, 1);
    // M42 Orion Nebula ~ RA 83.8°, Dec -5.4°
    expect(byId.get("M42")!.ra).toBeCloseTo(83.82, 1);
    expect(byId.get("M42")!.dec).toBeCloseTo(-5.39, 1);
    // M45 Pleiades ~ RA 56.8°, Dec +24.1°
    expect(byId.get("M45")!.kind).toBe("open-cluster");
  });
});
