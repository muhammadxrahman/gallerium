import { describe, it, expect } from "vitest";
import { eclipticPath, milkyWayBand } from "./referenceLines";

describe("eclipticPath", () => {
  const path = eclipticPath(2);

  it("passes through the equinoxes (Dec 0 at RA 0 and 180)", () => {
    const at0 = path.find((p) => p[0] === 0)!;
    const at180 = path.find((p) => p[0] === 180)!;
    expect(at0[1]).toBeCloseTo(0, 6);
    expect(at180[1]).toBeCloseTo(0, 6);
  });

  it("reaches the obliquity (~±23.44°) at the solstices (RA 90 / 270)", () => {
    const at90 = path.find((p) => Math.abs(p[0] - 90) < 1e-6)!;
    const at270 = path.find((p) => Math.abs(p[0] - 270) < 1e-6)!;
    expect(at90[1]).toBeCloseTo(23.4393, 3);
    expect(at270[1]).toBeCloseTo(-23.4393, 3);
  });
});

describe("milkyWayBand", () => {
  it("places the galactic center near RA 266°, Dec -29° (Sagittarius)", () => {
    const samples = milkyWayBand();
    // The l=0, b=0 sample is the galactic center.
    const center = samples.reduce((best, s) => (s.w > best.w ? s : best), samples[0]);
    expect(center.ra).toBeGreaterThan(263);
    expect(center.ra).toBeLessThan(269);
    expect(center.dec).toBeGreaterThan(-32);
    expect(center.dec).toBeLessThan(-26);
  });
});
