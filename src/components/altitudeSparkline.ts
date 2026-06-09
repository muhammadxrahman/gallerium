// Builds an inline SVG sparkline of a body's altitude across the next day, with the dark
// hours shaded and the horizon marked. Pure (returns a string), so it's unit-testable
// without a DOM. Consumed by the info card.

import type { AltSample } from "../astronomy/altitudeTrack";

const ALT_MIN = -20; // show a little below the horizon
const ALT_MAX = 90;

// Map an altitude (degrees) to a y pixel in [0, height] — higher altitude is higher up
// (smaller y). Clamped to the displayed range.
export function altToY(alt: number, height: number): number {
  const a = Math.max(ALT_MIN, Math.min(ALT_MAX, alt));
  return height * (1 - (a - ALT_MIN) / (ALT_MAX - ALT_MIN));
}

export interface SparklineOpts {
  width?: number;
  height?: number;
}

export function altitudeSparkline(
  track: AltSample[],
  sunTrack: AltSample[],
  opts: SparklineOpts = {}
): string {
  const w = opts.width ?? 240;
  const h = opts.height ?? 48;
  if (track.length < 2) return "";

  const n = track.length;
  const x = (i: number) => (i / (n - 1)) * w;

  // Night band(s): contiguous spans where the Sun is below the horizon.
  let bands = "";
  let spanStart: number | null = null;
  for (let i = 0; i < sunTrack.length; i++) {
    const dark = sunTrack[i].alt < 0;
    const last = i === sunTrack.length - 1;
    if (dark && spanStart === null) spanStart = i;
    if (spanStart !== null && (!dark || last)) {
      const end = dark && last ? i : i - 1;
      const x0 = x(spanStart);
      bands += `<rect x="${x0.toFixed(1)}" y="0" width="${(x(end) - x0).toFixed(1)}" height="${h}" fill="rgba(120,160,255,0.10)"/>`;
      spanStart = null;
    }
  }

  const horizonY = altToY(0, h).toFixed(1);
  const points = track.map((s, i) => `${x(i).toFixed(1)},${altToY(s.alt, h).toFixed(1)}`).join(" ");

  return (
    `<svg class="alt-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">` +
    bands +
    `<line x1="0" y1="${horizonY}" x2="${w}" y2="${horizonY}" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-dasharray="3 3"/>` +
    `<polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="1.5"/>` +
    `</svg>`
  );
}
