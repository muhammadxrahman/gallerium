// Altitude of a body over a time window — the data behind the info-card "tonight"
// sparkline. Pure (no DOM): given an equatorial position, observer, and start time, it
// samples the geometric altitude at fixed steps. A separate Sun track lets the chart
// shade the night. Refraction is intentionally omitted: this is an at-a-glance curve of
// when an object is up, not an ephemeris.

import { equatorialToHorizontal, type Observer } from "./coordinates";
import { getLST } from "./sidereal";
import { getSunPosition } from "./sun";

export interface AltSample {
  t: Date;
  alt: number; // degrees
}

function sampleCount(hours: number, stepMinutes: number): number {
  return Math.round((hours * 60) / stepMinutes);
}

// Altitude of a FIXED equatorial position over `hours`, every `stepMinutes`. Good for
// stars and deep-sky (truly fixed) and an acceptable approximation for the slow-moving
// planets; the Sun/Moon drift over a day but the curve shape stays representative.
export function altitudeTrack(
  ra: number,
  dec: number,
  observer: Observer,
  start: Date,
  hours = 24,
  stepMinutes = 20
): AltSample[] {
  const out: AltSample[] = [];
  const steps = sampleCount(hours, stepMinutes);
  for (let i = 0; i <= steps; i++) {
    const t = new Date(start.getTime() + i * stepMinutes * 60_000);
    const { alt } = equatorialToHorizontal({ ra, dec }, observer, getLST(t, observer.longitude));
    out.push({ t, alt });
  }
  return out;
}

// Sun altitude over the same window, recomputed each step (the Sun moves), so the chart
// can mark the dark hours.
export function sunAltitudeTrack(
  observer: Observer,
  start: Date,
  hours = 24,
  stepMinutes = 20
): AltSample[] {
  const out: AltSample[] = [];
  const steps = sampleCount(hours, stepMinutes);
  for (let i = 0; i <= steps; i++) {
    const t = new Date(start.getTime() + i * stepMinutes * 60_000);
    const sun = getSunPosition(t);
    const { alt } = equatorialToHorizontal({ ra: sun.ra, dec: sun.dec }, observer, getLST(t, observer.longitude));
    out.push({ t, alt });
  }
  return out;
}
