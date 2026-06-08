// Pure astronomy → rendered-position pipeline, extracted from main.ts so it can be
// unit-tested without a DOM. Given a catalog, observer, and time, it produces the
// apparent (refracted, topocentric, precessed) horizontal positions the renderer draws.

import { equatorialToHorizontal, type Observer } from "../astronomy/coordinates";
import { getLST } from "../astronomy/sidereal";
import { getAllPlanets } from "../astronomy/planets";
import { getVisibleSatellites, type TLE } from "../astronomy/satellites";
import { refractedAltitude } from "../astronomy/refraction";
import { precessFromJ2000 } from "../astronomy/precession";
import { topocentricCorrection } from "../astronomy/parallax";
import { getMoonPosition } from "../astronomy/moon";
import { getSunPosition } from "../astronomy/sun";
import { cleanProperName, type Star } from "../data/stars";
import type { RenderedStar } from "../render/stars";
import type { RenderedPlanet } from "../render/planets";
import type { RenderedSatellite } from "../render/satellites";
import type { RenderedMoon } from "../render/moon";
import type { RenderedSun } from "../render/sun";

export interface SkyBodies {
  stars: RenderedStar[];
  planets: RenderedPlanet[];
  moon: RenderedMoon | null;
  sun: RenderedSun | null;
  lst: number; // Local Sidereal Time (deg) at compute time — for projecting overlays
}

export const EMPTY_SKY: SkyBodies = { stars: [], planets: [], moon: null, sun: null, lst: 0 };

// Precess the J2000 catalog to a given epoch and sanitize names (cached catalogs
// parsed before the quote fix can carry a stray `""`).
export function precessCatalog(stars: Star[], epoch: Date): Star[] {
  return stars.map((s) => {
    const { ra, dec } = precessFromJ2000(s.ra, s.dec, epoch);
    return { ...s, ra, dec, name: cleanProperName(s.name) };
  });
}

// Geocentric RA/Dec → apparent horizontal (alt/az) with atmospheric refraction.
export function toApparentHorizontal(
  ra: number,
  dec: number,
  observer: Observer,
  lst: number
): { az: number; alt: number } {
  const { az, alt } = equatorialToHorizontal({ ra, dec }, observer, lst);
  return { az, alt: refractedAltitude(alt) };
}

export function computeBodies(
  precessedStars: Star[],
  observer: Observer,
  now: Date
): SkyBodies {
  const lst = getLST(now, observer.longitude);

  const stars = precessedStars.map((star) => ({
    ...star,
    ...toApparentHorizontal(star.ra, star.dec, observer, lst),
  }));

  const planets = getAllPlanets(now).map((p) => ({
    ...p,
    ...toApparentHorizontal(p.ra, p.dec, observer, lst),
  }));

  // Moon: topocentric-parallax correction (up to ~1°) before going to the horizon.
  const moonPos = getMoonPosition(now);
  const topo = topocentricCorrection(
    moonPos.ra,
    moonPos.dec,
    moonPos.distanceKm,
    observer.latitude,
    lst
  );
  const m = toApparentHorizontal(topo.ra, topo.dec, observer, lst);
  const moon: RenderedMoon = { ...moonPos, az: m.az, alt: m.alt };

  const sunPos = getSunPosition(now);
  const s = toApparentHorizontal(sunPos.ra, sunPos.dec, observer, lst);
  const sun: RenderedSun = { ...sunPos, az: s.az, alt: s.alt };

  return { stars, planets, moon, sun, lst };
}

// Satellites are only naked-eye visible when the observer is in darkness (Sun below
// −6°) AND the satellite is sunlit (not in Earth's shadow) — matching what you'd
// actually see. Returns [] otherwise.
export function computeSatellites(
  tles: TLE[],
  observer: Observer,
  sun: RenderedSun | null,
  now: Date
): RenderedSatellite[] {
  if (!sun || sun.alt >= -6) return [];

  const raR = sun.ra * (Math.PI / 180);
  const decR = sun.dec * (Math.PI / 180);
  const sunDir = {
    x: Math.cos(decR) * Math.cos(raR),
    y: Math.cos(decR) * Math.sin(raR),
    z: Math.sin(decR),
  };

  return getVisibleSatellites(tles, now, observer, sunDir)
    .filter((s) => s.sunlit)
    .map((s) => ({
      ...s,
      az: s.azimuth ?? 0,
      alt: refractedAltitude(s.elevationAngle ?? -90),
    }));
}
