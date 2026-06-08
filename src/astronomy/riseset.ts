import { getLST } from "./sidereal";
import type { Observer } from "./coordinates";

export interface RiseTransitSet {
  rise: Date | null;
  transit: Date | null;
  set: Date | null;
  circumpolar: boolean; // always above the horizon (never sets)
  neverRises: boolean; // always below the horizon
}

// Standard altitudes (deg) of the body's center at the rise/set instant.
export const STD_ALT_STAR = -0.566; // point source + mean refraction
export const STD_ALT_SUN = -0.833; // Sun's upper limb + refraction
export const TWILIGHT_CIVIL = -6;
export const TWILIGHT_NAUTICAL = -12;
export const TWILIGHT_ASTRONOMICAL = -18;

const SIDEREAL_DEG_PER_HOUR = 15.04107; // rate the LST advances

function toRad(d: number): number {
  return d * (Math.PI / 180);
}

// Signed hour angle (deg, -180..180) of RA at a given time/longitude.
function hourAngle(date: Date, raDeg: number, lon: number): number {
  const ha = getLST(date, lon) - raDeg;
  return (((ha + 180) % 360) + 360) % 360 - 180;
}

// Find the upper-culmination (transit) nearest `center` by locating the ascending
// zero-crossing of the hour angle within ±12h. Treats RA/Dec as fixed over the day —
// exact for stars, good for planets, approximate (~minutes) for the fast-moving Moon.
function findTransit(raDeg: number, lon: number, center: Date): Date | null {
  const stepMs = 4 * 60 * 1000;
  let prevT = center.getTime() - 12 * 3600 * 1000;
  let prevHA = hourAngle(new Date(prevT), raDeg, lon);
  for (let t = prevT + stepMs; t <= center.getTime() + 12 * 3600 * 1000; t += stepMs) {
    const ha = hourAngle(new Date(t), raDeg, lon);
    // Ascending crossing of 0, excluding the ±180 wrap at lower culmination.
    if (prevHA < 0 && ha >= 0 && ha - prevHA < 90) {
      const frac = -prevHA / (ha - prevHA);
      return new Date(prevT + frac * stepMs);
    }
    prevT = t;
    prevHA = ha;
  }
  return null;
}

export function riseTransitSet(
  raDeg: number,
  decDeg: number,
  observer: Observer,
  date: Date,
  standardAltDeg = STD_ALT_STAR
): RiseTransitSet {
  const lat = toRad(observer.latitude);
  const dec = toRad(decDeg);

  const cosH0 =
    (Math.sin(toRad(standardAltDeg)) - Math.sin(lat) * Math.sin(dec)) /
    (Math.cos(lat) * Math.cos(dec));

  const transit = findTransit(raDeg, observer.longitude, date);

  if (cosH0 < -1) {
    // Always above the standard altitude → never sets.
    return { rise: null, transit, set: null, circumpolar: true, neverRises: false };
  }
  if (cosH0 > 1) {
    return { rise: null, transit: null, set: null, circumpolar: false, neverRises: true };
  }

  const h0Hours = (Math.acos(cosH0) * (180 / Math.PI)) / SIDEREAL_DEG_PER_HOUR;
  const rise = transit ? new Date(transit.getTime() - h0Hours * 3600 * 1000) : null;
  const set = transit ? new Date(transit.getTime() + h0Hours * 3600 * 1000) : null;

  return { rise, transit, set, circumpolar: false, neverRises: false };
}
