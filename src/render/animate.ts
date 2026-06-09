// Pure animation math for the cinematic first-load reveal and the living-sky twinkle.
// No DOM/canvas, so it's unit-testable; the render loop and the star renderer call these.

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// Eased 0→1 ramp for the slice of overall reveal progress that falls in [start, end].
// Below `start` it's 0, above `end` it's 1; within, a smoothstep for a soft settle. Lets
// the reveal sequence phase each layer (dome → stars → lines → bodies) by handing each a
// different [start, end] window of the single 0→1 progress.
export function revealAlpha(progress: number, start: number, end: number): number {
  if (end <= start) return progress >= end ? 1 : 0;
  const t = clamp01((progress - start) / (end - start));
  return t * t * (3 - 2 * t); // smoothstep
}

// A bounded, periodic, per-seed scintillation factor in [-1, 1]. `seed` (a star id)
// de-synchronizes stars so they don't twinkle in unison. Cheap — a single sine.
export function twinkle(timeMs: number, seed: number): number {
  const phase = (seed % 997) * 0.0631; // spread starting phases across stars
  return Math.sin(timeMs * 0.0021 + phase);
}
