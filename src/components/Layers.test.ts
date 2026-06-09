import { describe, it, expect, afterEach } from "vitest";
import { getLayers, setLayer, setBortle } from "./Layers";
import { bortleLevel } from "../utils/bortle";

// Layer state is module-global (persisted to localStorage); reset what we touch.
afterEach(() => {
  setBortle(3);
  setLayer("nightVision", false);
});

describe("layer state", () => {
  it("has sensible defaults (full catalog, night vision off)", () => {
    const l = getLayers();
    expect(l.nightVision).toBe(false);
    expect(l.bortle).toBe(3);
    expect(l.magnitudeLimit).toBe(6.5);
    expect(l.deepSky).toBe(true);
  });

  it("setBortle drives the derived limiting magnitude and clamps to 1..9", () => {
    setBortle(8);
    expect(getLayers().bortle).toBe(8);
    expect(getLayers().magnitudeLimit).toBe(bortleLevel(8).limitMag);
    setBortle(99);
    expect(getLayers().bortle).toBe(9);
    setBortle(0);
    expect(getLayers().bortle).toBe(1);
  });

  it("toggles night vision", () => {
    expect(getLayers().nightVision).toBe(false);
    setLayer("nightVision", true);
    expect(getLayers().nightVision).toBe(true);
  });
});
