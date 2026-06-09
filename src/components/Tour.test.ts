import { describe, it, expect } from "vitest";
import { TOUR_STEPS, clampStep, shouldShowFirstRun } from "./Tour";
import { ICON_NAMES } from "./icons";

describe("shouldShowFirstRun", () => {
  it("shows the tour when the flag was never set", () => {
    expect(shouldShowFirstRun(null)).toBe(true);
  });
  it("does not show it once seen", () => {
    expect(shouldShowFirstRun("1")).toBe(false);
  });
});

describe("TOUR_STEPS", () => {
  it("has a sensible number of steps", () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(6);
    expect(TOUR_STEPS.length).toBeLessThanOrEqual(12);
  });

  it("every step has a title and a non-trivial, readable body", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.body.trim().length).toBeGreaterThan(20); // explains, not a stub
      expect(step.body.length).toBeLessThan(260); // stays a short, simple card
    }
  });

  it("references only real icons", () => {
    for (const step of TOUR_STEPS) {
      expect(ICON_NAMES).toContain(step.icon);
    }
  });

  it("covers each primary toolbar feature in plain language", () => {
    const titles = TOUR_STEPS.map((s) => s.title.toLowerCase());
    const text = TOUR_STEPS.map((s) => `${s.title} ${s.body}`.toLowerCase());
    const mentions = (kw: string) => text.some((t) => t.includes(kw));
    expect(titles.some((t) => t.includes("search"))).toBe(true);
    expect(mentions("time")).toBe(true);
    expect(mentions("map")).toBe(true);
    expect(mentions("tonight")).toBe(true);
    expect(mentions("settings")).toBe(true);
    expect(mentions("tap")).toBe(true); // identify / lock
    expect(mentions("zoom")).toBe(true);
  });

  it("avoids jargon a newcomer wouldn't know", () => {
    const blob = TOUR_STEPS.map((s) => `${s.title} ${s.body}`.toLowerCase()).join(" ");
    for (const jargon of ["azimuth", "altitude", "topocentric", "gnomonic", "magnitude", "ra/dec", "sidereal"]) {
      expect(blob).not.toContain(jargon);
    }
  });
});

describe("clampStep", () => {
  it("keeps the index within range", () => {
    expect(clampStep(-1, 5)).toBe(0); // can't go before the first step
    expect(clampStep(0, 5)).toBe(0);
    expect(clampStep(3, 5)).toBe(3);
    expect(clampStep(5, 5)).toBe(4); // can't go past the last step
    expect(clampStep(99, 5)).toBe(4);
  });
});
