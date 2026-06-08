import * as satellite from "satellite.js";
import type { Observer } from "./coordinates";

export interface SatellitePosition {
  name: string;
  ra: number;
  dec: number;
  altitude: number; // km above Earth
  azimuth?: number;      // topocentric, degrees (only set when an observer is given)
  elevationAngle?: number; // topocentric altitude above horizon, degrees
}

export interface TLE {
  name: string;
  line1: string;
  line2: string;
}

export function parseTLEs(raw: string): TLE[] {
  const lines = raw.trim().split("\n").map(l => l.trim()).filter(Boolean);
  const tles: TLE[] = [];

  for (let i = 0; i < lines.length; i += 3) {
    if (i + 2 < lines.length) {
      tles.push({
        name: lines[i],
        line1: lines[i + 1],
        line2: lines[i + 2],
      });
    }
  }

  return tles;
}

export function getSatellitePosition(
  tle: TLE,
  date: Date,
  observer?: Observer
): SatellitePosition | null {
  try {
    const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
    const positionAndVelocity = satellite.propagate(satrec, date);

    if (!positionAndVelocity) return null;
    if (
      typeof positionAndVelocity.position === "boolean" ||
      !positionAndVelocity.position
    ) {
      return null;
    }

    const positionEci = positionAndVelocity.position;

    // ECI to geodetic for altitude
    const gmst = satellite.gstime(date);
    const geodetic = satellite.eciToGeodetic(positionEci, gmst);
    const altitudeKm = geodetic.height; // km above the ellipsoid

    // ECI to RA/Dec (geocentric — kept for reference/identification)
    const r = Math.sqrt(
        positionEci.x ** 2 +
        positionEci.y ** 2 +
        positionEci.z ** 2
        );

    if (isNaN(r) || r === 0) return null;

    const dec = Math.asin(positionEci.z / r) * (180 / Math.PI);
    const ra = ((Math.atan2(positionEci.y, positionEci.x) * (180 / Math.PI)) + 360) % 360;

    // Topocentric look angles. Satellites are near-field (LEO ~400 km vs Earth's
    // ~6371 km radius), so the observer's position relative to the satellite
    // matters enormously — geocentric RA/Dec converted via the star pipeline can
    // be tens of degrees off. ecfToLookAngles gives the true az/elevation.
    let azimuth: number | undefined;
    let elevationAngle: number | undefined;
    if (observer) {
      const satEcf = satellite.eciToEcf(positionEci, gmst);
      const observerGd = {
        longitude: observer.longitude * (Math.PI / 180),
        latitude: observer.latitude * (Math.PI / 180),
        height: 0, // km above sea level; observer elevation is negligible here
      };
      const look = satellite.ecfToLookAngles(observerGd, satEcf);
      azimuth = ((look.azimuth * (180 / Math.PI)) % 360 + 360) % 360;
      elevationAngle = look.elevation * (180 / Math.PI);
    }

    return {
      name: tle.name,
      ra,
      dec,
      altitude: altitudeKm,
      azimuth,
      elevationAngle,
    };
  } catch {
    return null;
  }
}

export function getVisibleSatellites(
  tles: TLE[],
  date: Date,
  observer?: Observer
): SatellitePosition[] {
  return tles
    .map(tle => getSatellitePosition(tle, date, observer))
    .filter((s): s is SatellitePosition => s !== null);
}