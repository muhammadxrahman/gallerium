import { describe, it, expect } from "vitest";
import { OPTICS, opticLabel, opticRingRadiusPx } from "./optics";

describe("OPTICS presets", () => {
  it("starts with an Off (fov 0) option and lists real instruments", () => {
    expect(OPTICS[0]).toEqual({ label: "Off", fov: 0 });
    expect(OPTICS.some((o) => o.fov === 6.4)).toBe(true); // 7×50 binoculars
    for (const o of OPTICS) expect(o.fov).toBeGreaterThanOrEqual(0);
  });

  it("labels a known fov and falls back for an unknown one", () => {
    expect(opticLabel(6.4)).toBe("7×50 binoculars");
    expect(opticLabel(3.3)).toBe("3.3°");
  });
});

describe("opticRingRadiusPx (gnomonic geometry)", () => {
  it("is 0 when the optic is off", () => {
    expect(opticRingRadiusPx(0, 90, 400)).toBe(0);
  });

  it("lands at the screen edge when the optic field equals the view field", () => {
    // ring radius should equal minDim/2 (= 200 for a 400px view)
    expect(opticRingRadiusPx(90, 90, 400)).toBeCloseTo(200, 6);
  });

  it("grows with optic field and shrinks as you zoom in (smaller view fov)", () => {
    const wide = opticRingRadiusPx(5, 90, 400);
    const wider = opticRingRadiusPx(6.4, 90, 400);
    expect(wider).toBeGreaterThan(wide);
    // Zooming in (narrower view fov) makes the same optic field fill more of the screen.
    expect(opticRingRadiusPx(5, 45, 400)).toBeGreaterThan(opticRingRadiusPx(5, 90, 400));
  });
});
