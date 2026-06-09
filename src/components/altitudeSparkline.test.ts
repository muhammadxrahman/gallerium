import { describe, it, expect } from "vitest";
import { altToY, altitudeSparkline } from "./altitudeSparkline";
import type { AltSample } from "../astronomy/altitudeTrack";

function track(alts: number[]): AltSample[] {
  return alts.map((alt, i) => ({ t: new Date(i * 60_000), alt }));
}

describe("altToY", () => {
  it("maps the top of the range to y=0 and the bottom to y=height", () => {
    expect(altToY(90, 100)).toBe(0);
    expect(altToY(-20, 100)).toBe(100);
  });

  it("is monotonic — higher altitude is higher up (smaller y)", () => {
    expect(altToY(60, 100)).toBeLessThan(altToY(10, 100));
  });

  it("clamps altitudes outside the displayed range", () => {
    expect(altToY(180, 100)).toBe(0);
    expect(altToY(-90, 100)).toBe(100);
  });
});

describe("altitudeSparkline", () => {
  const obj = track([10, 40, 70, 40, 10, -10, -30]);
  const sun = track([-20, -10, 5, 20, 5, -10, -20]); // dark at both ends, daylight mid

  it("returns an SVG with the altitude polyline and a dashed horizon line", () => {
    const svg = altitudeSparkline(obj, sun);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<polyline");
    expect(svg).toContain("stroke-dasharray"); // horizon line
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });

  it("shades the dark spans as night bands", () => {
    expect(altitudeSparkline(obj, sun)).toContain("<rect");
  });

  it("draws no night band when the Sun is up the whole window", () => {
    const allDay = track([10, 20, 30, 20, 10]);
    const sunUp = track([10, 15, 20, 15, 10]);
    expect(altitudeSparkline(allDay, sunUp)).not.toContain("<rect");
  });

  it("returns empty markup for too-few samples", () => {
    expect(altitudeSparkline(track([5]), track([5]))).toBe("");
  });
});
