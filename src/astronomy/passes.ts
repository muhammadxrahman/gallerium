import { getSatellitePosition, type TLE } from "./satellites";
import { getSunPosition } from "./sun";
import { getLST } from "./sidereal";
import { equatorialToHorizontal, type Observer } from "./coordinates";

export interface SatellitePass {
  start: Date;
  end: Date;
  peakTime: Date;
  peakElevation: number; // degrees
  startAz: number; // degrees
  endAz: number; // degrees
}

export interface PassOptions {
  hours?: number; // look-ahead window (default 24)
  stepSec?: number; // sampling step (default 30)
  minElevation?: number; // a "pass" peaks above this (default 10°)
  visibleOnly?: boolean; // require sunlit sat + dark observer (default true)
}

function sunAltitude(date: Date, observer: Observer): number {
  const s = getSunPosition(date);
  const lst = getLST(date, observer.longitude);
  return equatorialToHorizontal({ ra: s.ra, dec: s.dec }, observer, lst).alt;
}

function sunDirEci(date: Date) {
  const s = getSunPosition(date);
  const ra = (s.ra * Math.PI) / 180;
  const dec = (s.dec * Math.PI) / 180;
  return { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) };
}

// Predict upcoming passes of a satellite over the observer. With visibleOnly, a pass
// only counts while the satellite is sunlit AND the observer is in darkness — i.e. an
// actually-watchable pass. Each pass records its rise/set bearings and peak altitude.
export function predictPasses(
  tle: TLE,
  observer: Observer,
  from: Date,
  opts: PassOptions = {}
): SatellitePass[] {
  const hours = opts.hours ?? 24;
  const stepMs = (opts.stepSec ?? 30) * 1000;
  const minEl = opts.minElevation ?? 10;
  const visibleOnly = opts.visibleOnly ?? true;
  const end = from.getTime() + hours * 3600 * 1000;

  const passes: SatellitePass[] = [];
  let cur: SatellitePass | null = null;

  for (let t = from.getTime(); t <= end; t += stepMs) {
    const date = new Date(t);
    const dark = !visibleOnly || sunAltitude(date, observer) < -6;
    const pos = dark ? getSatellitePosition(tle, date, observer, sunDirEci(date)) : null;
    const el = pos?.elevationAngle ?? -90;
    const up = !!pos && el > 0 && (!visibleOnly || pos.sunlit === true);

    if (up) {
      const az = pos!.azimuth ?? 0;
      if (!cur) {
        cur = { start: date, end: date, peakTime: date, peakElevation: el, startAz: az, endAz: az };
      } else {
        cur.end = date;
        cur.endAz = az;
        if (el > cur.peakElevation) {
          cur.peakElevation = el;
          cur.peakTime = date;
        }
      }
    } else if (cur) {
      if (cur.peakElevation >= minEl) passes.push(cur);
      cur = null;
    }
  }
  if (cur && cur.peakElevation >= minEl) passes.push(cur);

  return passes;
}
