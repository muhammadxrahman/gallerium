import { describe, it, expect } from "vitest";
import { BORTLE_SCALE, bortleLevel, DEFAULT_BORTLE } from "./bortle";

describe("bortle scale", () => {
  it("covers classes 1..9 in order", () => {
    expect(BORTLE_SCALE.map((b) => b.class)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("looks up by class and clamps/rounds out-of-range input", () => {
    expect(bortleLevel(1).class).toBe(1);
    expect(bortleLevel(9).class).toBe(9);
    expect(bortleLevel(0).class).toBe(1); // clamp low
    expect(bortleLevel(99).class).toBe(9); // clamp high
    expect(bortleLevel(4.4).class).toBe(4); // rounds
  });

  it("limiting magnitude decreases (or holds) toward the city and caps at the catalog's 6.5", () => {
    expect(bortleLevel(1).limitMag).toBe(6.5);
    for (let c = 2; c <= 9; c++) {
      expect(bortleLevel(c).limitMag).toBeLessThanOrEqual(bortleLevel(c - 1).limitMag);
      expect(bortleLevel(c).limitMag).toBeLessThanOrEqual(6.5);
    }
    expect(bortleLevel(9).limitMag).toBeLessThan(bortleLevel(1).limitMag);
  });

  it("Milky Way fades from full (dark sky) to invisible (city)", () => {
    expect(bortleLevel(1).milkyWay).toBe(1);
    expect(bortleLevel(9).milkyWay).toBe(0);
    for (let c = 2; c <= 9; c++) {
      expect(bortleLevel(c).milkyWay).toBeLessThanOrEqual(bortleLevel(c - 1).milkyWay);
    }
  });

  it("defaults to a dark site that shows the full catalog", () => {
    expect(bortleLevel(DEFAULT_BORTLE).limitMag).toBe(6.5);
  });
});
