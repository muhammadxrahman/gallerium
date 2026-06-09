import { describe, it, expect } from "vitest";
import { computeHighlights, dirName, clockStr, angularSeparation, meteorShowerText } from "./highlights";
import { computeBodies } from "./compute";
import { parseTLEs } from "../astronomy/satellites";
import type { ActiveShower } from "./meteorShowers";

const NYC = { latitude: 40.71, longitude: -74.006 };
const DATE = new Date("2024-09-15T02:30:00Z");
const ISS = parseTLEs(`ISS (ZARYA)
1 25544U 98067A   24015.50000000  .00016717  00000-0  10270-3 0  9993
2 25544  51.6412  96.6644 0002988 280.4423  79.6187 15.49572959433729`);

describe("dirName", () => {
  it("maps azimuth to 16-point compass names", () => {
    expect(dirName(0)).toBe("N");
    expect(dirName(90)).toBe("E");
    expect(dirName(180)).toBe("S");
    expect(dirName(270)).toBe("W");
    expect(dirName(360)).toBe("N");
    expect(dirName(45)).toBe("NE");
  });
});

describe("angularSeparation", () => {
  it("is 0 for identical points and ~90° for orthogonal ones", () => {
    expect(angularSeparation(10, 20, 10, 20)).toBeCloseTo(0, 6);
    expect(angularSeparation(0, 0, 90, 0)).toBeCloseTo(90, 6);
    expect(angularSeparation(0, -10, 0, 10)).toBeCloseTo(20, 6);
  });
});

describe("clockStr", () => {
  it("formats a time without throwing", () => {
    expect(typeof clockStr(DATE)).toBe("string");
  });
});

describe("computeHighlights", () => {
  const sky = computeBodies([], NYC, DATE);
  const items = computeHighlights(sky, NYC, DATE, ISS);

  it("produces a non-empty feed of {icon, text} items", () => {
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      expect(typeof i.text).toBe("string");
      expect(i.icon).toContain("<svg"); // icons are inline SVG, not emoji
    }
  });

  it("includes a Sun line (sunset / astro-dark)", () => {
    expect(items.some((i) => /Sunset|astro-dark/.test(i.text))).toBe(true);
  });

  it("includes a Moon phase line", () => {
    expect(items.some((i) => /Moon|Crescent|Gibbous|Quarter/.test(i.text))).toBe(true);
  });

  it("surfaces an active meteor shower (Geminids in mid-December)", () => {
    const dec = new Date("2025-12-14T05:00:00Z");
    const decItems = computeHighlights(computeBodies([], NYC, dec), NYC, dec, ISS);
    expect(decItems.some((i) => /Geminids/.test(i.text))).toBe(true);
  });

  it("attaches guide targets to tappable rows (Moon, planets)", () => {
    expect(items.some((i) => i.target?.kind === "moon")).toBe(true);
    expect(items.some((i) => i.target?.kind === "planet")).toBe(true);
  });

  it("leaves the ISS pass row non-tappable when present (future event, no fixed position)", () => {
    const iss = items.find((i) => /ISS/.test(i.text));
    if (iss) expect(iss.target).toBeUndefined();
  });

  it("makes a meteor-shower row guide to its radiant (a point target)", () => {
    const dec = new Date("2025-12-14T05:00:00Z");
    const decItems = computeHighlights(computeBodies([], NYC, dec), NYC, dec, ISS);
    const gem = decItems.find((i) => /Geminids/.test(i.text));
    expect(gem?.target?.kind).toBe("point");
  });
});

describe("meteorShowerText", () => {
  const base: ActiveShower = {
    shower: {
      name: "Geminids",
      peakLon: 262.2,
      startLon: 255,
      endLon: 267,
      radiantRA: 112,
      radiantDec: 33,
      zhr: 150,
      parent: "(3200) Phaethon",
    },
    daysToPeak: 0,
    radiantAlt: 45,
  };

  it("says 'peaks tonight' at the peak and shows the radiant altitude + ideal rate", () => {
    const t = meteorShowerText(base);
    expect(t).toContain("Geminids");
    expect(t).toContain("peaks tonight");
    expect(t).toContain("radiant 45° up");
    expect(t).toContain("up to 150/hr ideal");
  });

  it("counts down to an upcoming peak and notes a radiant below the horizon", () => {
    const t = meteorShowerText({ ...base, daysToPeak: 3, radiantAlt: -12 });
    expect(t).toContain("peaks in 3d");
    expect(t).toContain("radiant below horizon");
  });

  it("reports a past peak", () => {
    expect(meteorShowerText({ ...base, daysToPeak: -2 })).toContain("peaked 2d ago");
  });
});
