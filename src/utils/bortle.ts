// The Bortle dark-sky scale (1 = pristine, 9 = inner city) mapped to what this app can
// actually show: a naked-eye limiting magnitude and a Milky Way visibility factor. The
// HYG catalog is trimmed at magnitude 6.5, so `limitMag` caps there — we can't render
// stars fainter than we have — which is why classes 1–3 share the catalog limit.

export interface BortleLevel {
  class: number; // 1..9
  label: string; // short site description
  limitMag: number; // limiting magnitude to render (≤ catalog's 6.5)
  milkyWay: number; // 0..1 Milky Way visibility multiplier
}

export const BORTLE_SCALE: BortleLevel[] = [
  { class: 1, label: "Excellent dark sky", limitMag: 6.5, milkyWay: 1.0 },
  { class: 2, label: "Typical dark sky", limitMag: 6.5, milkyWay: 1.0 },
  { class: 3, label: "Rural sky", limitMag: 6.5, milkyWay: 0.95 },
  { class: 4, label: "Rural / suburban", limitMag: 6.2, milkyWay: 0.75 },
  { class: 5, label: "Suburban sky", limitMag: 5.6, milkyWay: 0.45 },
  { class: 6, label: "Bright suburban", limitMag: 5.1, milkyWay: 0.25 },
  { class: 7, label: "Suburban / urban", limitMag: 4.6, milkyWay: 0.1 },
  { class: 8, label: "City sky", limitMag: 4.2, milkyWay: 0.0 },
  { class: 9, label: "Inner-city sky", limitMag: 4.0, milkyWay: 0.0 },
];

export const DEFAULT_BORTLE = 3; // shows the full catalog by default

// Look up a level by class, clamped to the valid 1..9 range.
export function bortleLevel(cls: number): BortleLevel {
  const c = Math.max(1, Math.min(9, Math.round(cls)));
  return BORTLE_SCALE[c - 1];
}
