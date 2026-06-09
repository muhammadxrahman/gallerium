// Meteor-shower resolution — pure (no DOM), so it's unit-testable. Given a date it finds
// which showers are active and how close each is to its peak, both keyed off the Sun's
// ecliptic longitude (λ☉); given an observer it adds the current radiant altitude (showers
// are best when the radiant is high). The Tonight feed formats the result.

import { getSunPosition } from "../astronomy/sun";
import { equatorialToHorizontal, type Observer } from "../astronomy/coordinates";
import { getLST } from "../astronomy/sidereal";
import { METEOR_SHOWERS, type MeteorShower } from "../data/meteorShowers";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const OBLIQUITY = 23.439291 * D2R;
const DEG_PER_DAY = 360 / 365.2422; // mean solar motion, for λ☉ → days

function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// Sun's apparent ecliptic longitude (λ☉) in degrees, derived from its RA/Dec. The Sun's
// ecliptic latitude is ~0, so this recovers λ☉ to sub-arcminute accuracy.
export function solarLongitude(date: Date): number {
  const { ra, dec } = getSunPosition(date);
  const a = ra * D2R;
  const d = dec * D2R;
  const lambda =
    Math.atan2(Math.sin(a) * Math.cos(OBLIQUITY) + Math.tan(d) * Math.sin(OBLIQUITY), Math.cos(a)) * R2D;
  return norm360(lambda);
}

// Shortest signed angular gap a→b in degrees, in (−180, 180].
function signedGap(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

// Is λ within the [start, end] window, handling a wrap through 360°?
export function inWindow(lambda: number, start: number, end: number): boolean {
  const L = norm360(lambda);
  const s = norm360(start);
  const e = norm360(end);
  return s <= e ? L >= s && L <= e : L >= s || L <= e;
}

export interface ActiveShower {
  shower: MeteorShower;
  daysToPeak: number; // signed: >0 upcoming, <0 past, ~0 tonight
  radiantAlt: number; // current radiant altitude for the observer (deg)
}

// Active showers for the given instant, each with days-to-peak and the radiant's current
// altitude, sorted soonest-to-peak first. `observer` lets us report radiant altitude.
export function activeShowers(date: Date, observer: Observer): ActiveShower[] {
  const lambda = solarLongitude(date);
  const lst = getLST(date, observer.longitude);

  return METEOR_SHOWERS.filter((s) => inWindow(lambda, s.startLon, s.endLon))
    .map((shower) => {
      const { alt } = equatorialToHorizontal(
        { ra: shower.radiantRA, dec: shower.radiantDec },
        observer,
        lst
      );
      return {
        shower,
        daysToPeak: signedGap(lambda, shower.peakLon) / DEG_PER_DAY,
        radiantAlt: alt,
      };
    })
    .sort((a, b) => Math.abs(a.daysToPeak) - Math.abs(b.daysToPeak));
}
