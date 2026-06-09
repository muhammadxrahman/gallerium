import { describe, it, expect } from "vitest";
import {
  createScheduler,
  tick,
  markDirty,
  invalidate,
  BODIES_INTERVAL_MS,
  SAT_INTERVAL_MS,
  ORI_EPSILON,
  AMBIENT_INTERVAL_MS,
} from "./scheduler";

const noOri = { hasTles: true, viewVersion: 0, orientation: null };

describe("createScheduler", () => {
  it("starts dirty so the first frame draws", () => {
    const s = createScheduler();
    const r = tick(s, { t: 0, ...noOri });
    expect(r.redraw).toBe(true);
  });
});

describe("tick — compute cadence", () => {
  it("recomputes bodies and satellites on the very first tick", () => {
    const s = createScheduler();
    const r = tick(s, { t: 0, ...noOri });
    expect(r.recomputeBodies).toBe(true);
    expect(r.recomputeSatellites).toBe(true);
  });

  it("holds bodies until BODIES_INTERVAL_MS has elapsed", () => {
    const s = createScheduler();
    tick(s, { t: 1000, ...noOri }); // primes lastBodiesAt = 1000
    expect(tick(s, { t: 1000 + BODIES_INTERVAL_MS - 1, ...noOri }).recomputeBodies).toBe(false);
    expect(tick(s, { t: 1000 + BODIES_INTERVAL_MS, ...noOri }).recomputeBodies).toBe(true);
  });

  it("recomputes satellites more often than bodies", () => {
    const s = createScheduler();
    tick(s, { t: 0, ...noOri }); // both fire, last* = 0
    // After one satellite interval: sats fire again, bodies don't.
    const r = tick(s, { t: SAT_INTERVAL_MS, ...noOri });
    expect(r.recomputeSatellites).toBe(true);
    expect(r.recomputeBodies).toBe(false);
  });

  it("never recomputes satellites when no TLEs are loaded", () => {
    const s = createScheduler();
    const r = tick(s, { t: 0, hasTles: false, viewVersion: 0, orientation: null });
    expect(r.recomputeSatellites).toBe(false);
    expect(r.recomputeBodies).toBe(true); // bodies are independent of TLEs
  });

  it("a recompute forces a redraw", () => {
    const s = createScheduler();
    tick(s, { t: 0, ...noOri }); // clears initial needsRedraw
    const r = tick(s, { t: BODIES_INTERVAL_MS, ...noOri });
    expect(r.recomputeBodies).toBe(true);
    expect(r.redraw).toBe(true);
  });
});

describe("tick — draw-on-change", () => {
  it("an idle frame with nothing changed does not redraw", () => {
    const s = createScheduler();
    tick(s, { t: 5000, ...noOri }); // settle: bodies+sats compute, needsRedraw cleared
    const r = tick(s, { t: 5001, hasTles: false, viewVersion: 0, orientation: null });
    expect(r.recomputeBodies).toBe(false);
    expect(r.recomputeSatellites).toBe(false);
    expect(r.redraw).toBe(false);
  });

  it("redraws when the view version changes (zoom / pan)", () => {
    const s = createScheduler();
    tick(s, { t: 5000, hasTles: false, viewVersion: 0, orientation: null });
    const r = tick(s, { t: 5001, hasTles: false, viewVersion: 1, orientation: null });
    expect(r.redraw).toBe(true);
  });

  it("redraws on an orientation move past the epsilon, ignores jitter below it", () => {
    const s = createScheduler();
    const base = { hasTles: false, viewVersion: 0 };
    tick(s, { t: 5000, ...base, orientation: { azimuth: 100, altitude: 30 } }); // seed
    // Sub-epsilon wobble → no redraw.
    const jitter = tick(s, {
      t: 5001,
      ...base,
      orientation: { azimuth: 100 + ORI_EPSILON / 2, altitude: 30 },
    });
    expect(jitter.redraw).toBe(false);
    // A real turn → redraw.
    const turn = tick(s, { t: 5002, ...base, orientation: { azimuth: 105, altitude: 30 } });
    expect(turn.redraw).toBe(true);
  });
});

describe("markDirty / invalidate", () => {
  it("markDirty forces a single redraw without resetting the compute cadence", () => {
    const s = createScheduler();
    tick(s, { t: 5000, hasTles: false, viewVersion: 0, orientation: null }); // settle
    markDirty(s);
    const r = tick(s, { t: 5001, hasTles: false, viewVersion: 0, orientation: null });
    expect(r.redraw).toBe(true);
    expect(r.recomputeBodies).toBe(false); // cadence untouched
  });

  it("invalidate forces an immediate recompute next tick", () => {
    const s = createScheduler();
    tick(s, { t: 5000, ...noOri }); // settle: last* = 5000
    invalidate(s);
    const r = tick(s, { t: 5001, ...noOri }); // only 1ms later, but invalidated
    expect(r.recomputeBodies).toBe(true);
    expect(r.recomputeSatellites).toBe(true);
    expect(r.redraw).toBe(true);
  });
});

describe("ambient cadence (living sky)", () => {
  const idle = { hasTles: false, viewVersion: 0, orientation: null };

  it("redraws at ~AMBIENT_INTERVAL_MS while active, and not faster", () => {
    const s = createScheduler();
    tick(s, { t: 5000, ...idle, ambientActive: true }); // settle + first ambient tick
    // Too soon → no ambient redraw (and nothing else changed).
    expect(tick(s, { t: 5000 + AMBIENT_INTERVAL_MS - 1, ...idle, ambientActive: true }).redraw).toBe(false);
    // At the interval → ambient redraw fires.
    expect(tick(s, { t: 5000 + AMBIENT_INTERVAL_MS, ...idle, ambientActive: true }).redraw).toBe(true);
  });

  it("does nothing when inactive (stays draw-on-change)", () => {
    const s = createScheduler();
    tick(s, { t: 5000, ...idle }); // settle, needsRedraw cleared, lastBodiesAt = 5000
    // Probes stay inside the 1s bodies window so only the ambient gate could fire.
    expect(tick(s, { t: 5050, ...idle, ambientActive: false }).redraw).toBe(false);
    expect(tick(s, { t: 5300, ...idle, ambientActive: false }).redraw).toBe(false);
  });

  it("re-activating fires immediately rather than after a stale gap", () => {
    const s = createScheduler();
    tick(s, { t: 1000, ...idle, ambientActive: true }); // ambient clock = 1000
    // Long inactive stretch (clock not advanced while inactive).
    tick(s, { t: 20_000, ...idle, ambientActive: false });
    // Re-activate well past the interval → fires this tick.
    expect(tick(s, { t: 20_050, ...idle, ambientActive: true }).redraw).toBe(true);
  });
});
