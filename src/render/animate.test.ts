import { describe, it, expect } from "vitest";
import { clamp01, revealAlpha, twinkle } from "./animate";

describe("clamp01", () => {
  it("clamps to [0, 1]", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(2)).toBe(1);
  });
});

describe("revealAlpha", () => {
  it("is 0 before the window and 1 after it", () => {
    expect(revealAlpha(0.1, 0.3, 0.8)).toBe(0);
    expect(revealAlpha(0.9, 0.3, 0.8)).toBe(1);
  });

  it("rises monotonically through the window (smoothstep)", () => {
    const a = revealAlpha(0.4, 0.3, 0.8);
    const b = revealAlpha(0.55, 0.3, 0.8);
    const c = revealAlpha(0.7, 0.3, 0.8);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(c).toBeLessThan(1);
  });

  it("is ~0.5 at the window midpoint", () => {
    expect(revealAlpha(0.55, 0.3, 0.8)).toBeCloseTo(0.5, 6);
  });

  it("handles a zero-width window without dividing by zero", () => {
    expect(revealAlpha(0.5, 0.5, 0.5)).toBe(1); // progress >= end
    expect(revealAlpha(0.4, 0.5, 0.5)).toBe(0);
  });
});

describe("twinkle", () => {
  it("stays within [-1, 1]", () => {
    for (let t = 0; t < 5000; t += 137) {
      for (const seed of [1, 42, 998, 12345]) {
        const v = twinkle(t, seed);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("de-synchronizes different stars (different seeds differ at the same time)", () => {
    expect(twinkle(1000, 1)).not.toBeCloseTo(twinkle(1000, 500), 3);
  });

  it("varies over time for a given star", () => {
    expect(twinkle(0, 7)).not.toBeCloseTo(twinkle(800, 7), 3);
  });
});
