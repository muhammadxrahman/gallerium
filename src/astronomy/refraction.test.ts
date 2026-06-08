import { describe, it, expect } from "vitest";
import { refractedAltitude } from "./refraction";

describe("refractedAltitude", () => {
  it("lifts a horizon object by ~0.57°", () => {
    const lift = refractedAltitude(0) - 0;
    expect(lift).toBeGreaterThan(0.5);
    expect(lift).toBeLessThan(0.62);
  });

  it("has a tiny effect at mid altitude (~1' at 45°)", () => {
    const lift = refractedAltitude(45) - 45;
    expect(lift).toBeGreaterThan(0.005);
    expect(lift).toBeLessThan(0.03);
  });

  it("is essentially zero at the zenith", () => {
    expect(Math.abs(refractedAltitude(90) - 90)).toBeLessThan(0.001);
  });

  it("decreases monotonically with altitude", () => {
    const r5 = refractedAltitude(5) - 5;
    const r20 = refractedAltitude(20) - 20;
    const r60 = refractedAltitude(60) - 60;
    expect(r5).toBeGreaterThan(r20);
    expect(r20).toBeGreaterThan(r60);
  });

  it("leaves well-below-horizon altitudes unchanged", () => {
    expect(refractedAltitude(-5)).toBe(-5);
  });
});
