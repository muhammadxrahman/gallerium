import { describe, it, expect } from "vitest";
import { solarLongitude, inWindow, activeShowers } from "./meteorShowers";

const NYC = { latitude: 40.71, longitude: -74.006 };

describe("solarLongitude", () => {
  // λ☉ is 0 / 90 / 180 / 270 at the equinoxes and solstices, by definition. 2025 UTC
  // instants — this is verifiable ground truth, so it proves the timing anchor.
  it("matches the equinoxes and solstices", () => {
    const march = solarLongitude(new Date("2025-03-20T09:01:00Z"));
    expect(Math.min(march, 360 - march)).toBeLessThan(0.5); // ~0 (or ~360)
    expect(solarLongitude(new Date("2025-06-21T02:42:00Z"))).toBeCloseTo(90, 0);
    expect(solarLongitude(new Date("2025-09-22T18:19:00Z"))).toBeCloseTo(180, 0);
    expect(solarLongitude(new Date("2025-12-21T15:03:00Z"))).toBeCloseTo(270, 0);
  });
});

describe("inWindow", () => {
  it("handles an ordinary range", () => {
    expect(inWindow(262, 255, 267)).toBe(true);
    expect(inWindow(250, 255, 267)).toBe(false);
    expect(inWindow(255, 255, 267)).toBe(true); // inclusive at the edge
  });

  it("handles a window that wraps through 360°", () => {
    expect(inWindow(359, 350, 10)).toBe(true);
    expect(inWindow(5, 350, 10)).toBe(true);
    expect(inWindow(180, 350, 10)).toBe(false);
  });
});

describe("activeShowers", () => {
  it("flags the Geminids in mid-December but not in June", () => {
    const dec = activeShowers(new Date("2025-12-14T05:00:00Z"), NYC).map((a) => a.shower.name);
    expect(dec).toContain("Geminids");
    const jun = activeShowers(new Date("2025-06-15T05:00:00Z"), NYC).map((a) => a.shower.name);
    expect(jun).not.toContain("Geminids");
  });

  it("flags the Perseids in mid-August", () => {
    const aug = activeShowers(new Date("2025-08-12T08:00:00Z"), NYC).map((a) => a.shower.name);
    expect(aug).toContain("Perseids");
  });

  it("reports days-to-peak near zero at the peak, with a real radiant altitude", () => {
    const gem = activeShowers(new Date("2025-12-14T05:00:00Z"), NYC).find(
      (a) => a.shower.name === "Geminids"
    )!;
    expect(gem).toBeDefined();
    expect(Math.abs(gem.daysToPeak)).toBeLessThan(2);
    expect(gem.radiantAlt).toBeGreaterThanOrEqual(-90);
    expect(gem.radiantAlt).toBeLessThanOrEqual(90);
  });

  it("orders active showers soonest-to-peak first", () => {
    const list = activeShowers(new Date("2025-08-12T08:00:00Z"), NYC);
    for (let i = 1; i < list.length; i++) {
      expect(Math.abs(list[i].daysToPeak)).toBeGreaterThanOrEqual(Math.abs(list[i - 1].daysToPeak));
    }
  });
});
