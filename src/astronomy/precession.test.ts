import { describe, it, expect } from "vitest";
import { precessFromJ2000 } from "./precession";

describe("precessFromJ2000", () => {
  it("is the identity at the J2000 epoch", () => {
    const j2000 = new Date("2000-01-01T12:00:00Z");
    const r = precessFromJ2000(123.4, -27.8, j2000);
    expect(r.ra).toBeCloseTo(123.4, 3);
    expect(r.dec).toBeCloseTo(-27.8, 3);
  });

  it("moves an equator/equinox point ~0.64°/0.28° by 2050 (Meeus reference)", () => {
    const d2050 = new Date("2050-01-01T12:00:00Z");
    const r = precessFromJ2000(0, 0, d2050);
    expect(r.ra).toBeGreaterThan(0.55);
    expect(r.ra).toBeLessThan(0.72);
    expect(r.dec).toBeGreaterThan(0.24);
    expect(r.dec).toBeLessThan(0.32);
  });

  it("produces a sub-degree shift for a near-term date (2025)", () => {
    const d2025 = new Date("2025-01-01T00:00:00Z");
    const ra0 = 45;
    const r = precessFromJ2000(ra0, 10, d2025);
    const shift = Math.hypot(r.ra - ra0, r.dec - 10);
    expect(shift).toBeGreaterThan(0.2);
    expect(shift).toBeLessThan(0.5);
  });
});
