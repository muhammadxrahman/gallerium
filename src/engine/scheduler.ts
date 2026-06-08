// The render loop's decision logic, extracted from main.ts so it can be unit-tested
// without RAF / a canvas. It owns no astronomy and no drawing — it only answers, each
// frame, "what changed since last time, so what must I recompute and redraw?".
//
// The model (see CLAUDE.md "Render loop"): computing alt/az for ~9k stars depends only
// on (time, observer), so bodies recompute on a slow cadence and satellites on a faster
// one; an actual draw happens only when something changed (a compute tick, a view
// zoom/pan, an orientation move past an epsilon, or an explicit markDirty/invalidate).

export const BODIES_INTERVAL_MS = 1000; // stars, planets, Moon, Sun — slow movers
export const SAT_INTERVAL_MS = 250; // satellites move fast (ISS up to ~1°/s)
export const ORI_EPSILON = 0.05; // ignore sub-0.05° orientation jitter (degrees)

export interface SchedulerState {
  lastBodiesAt: number;
  lastSatAt: number;
  lastViewVersion: number;
  lastOriAz: number;
  lastOriAlt: number;
  needsRedraw: boolean;
}

export function createScheduler(): SchedulerState {
  return {
    lastBodiesAt: -Infinity,
    lastSatAt: -Infinity,
    lastViewVersion: -1,
    lastOriAz: NaN,
    lastOriAlt: NaN,
    needsRedraw: true, // draw the first frame
  };
}

// Force a redraw next frame (e.g. selection, view toggle, resize).
export function markDirty(s: SchedulerState): void {
  s.needsRedraw = true;
}

// Force an immediate recompute next frame (e.g. after a location/time change) — the
// timestamps are reset so the cadence gates fire regardless of how recently they ran.
export function invalidate(s: SchedulerState): void {
  s.lastBodiesAt = -Infinity;
  s.lastSatAt = -Infinity;
  s.needsRedraw = true;
}

export interface TickInput {
  t: number; // current timestamp (ms), e.g. the RAF high-res time
  hasTles: boolean; // skip satellite recompute when no TLEs are loaded
  viewVersion: number; // bumped by zoom/pan; a change forces a redraw
  // Current device orientation when in AR (sky view + listening); null otherwise.
  orientation: { azimuth: number; altitude: number } | null;
}

export interface TickResult {
  recomputeBodies: boolean;
  recomputeSatellites: boolean;
  redraw: boolean;
}

// Advance the scheduler one frame. Mutates `s` (timestamps / last-seen values /
// needsRedraw) and returns what the caller must do this frame. The caller performs the
// side effects (recompute via the engine, draw to canvas); this stays pure.
export function tick(s: SchedulerState, input: TickInput): TickResult {
  const recomputeBodies = input.t - s.lastBodiesAt >= BODIES_INTERVAL_MS;
  if (recomputeBodies) s.lastBodiesAt = input.t;

  const recomputeSatellites = input.hasTles && input.t - s.lastSatAt >= SAT_INTERVAL_MS;
  if (recomputeSatellites) s.lastSatAt = input.t;

  let redraw = s.needsRedraw || recomputeBodies || recomputeSatellites;

  if (input.viewVersion !== s.lastViewVersion) {
    s.lastViewVersion = input.viewVersion;
    redraw = true;
  }

  if (input.orientation) {
    const { azimuth, altitude } = input.orientation;
    // The first sample (last* still NaN) always initializes + redraws — comparing
    // against NaN is always false, so without this the gate would never fire.
    const firstSample = Number.isNaN(s.lastOriAz);
    if (
      firstSample ||
      Math.abs(azimuth - s.lastOriAz) > ORI_EPSILON ||
      Math.abs(altitude - s.lastOriAlt) > ORI_EPSILON
    ) {
      s.lastOriAz = azimuth;
      s.lastOriAlt = altitude;
      redraw = true;
    }
  }

  s.needsRedraw = false;
  return { recomputeBodies, recomputeSatellites, redraw };
}
