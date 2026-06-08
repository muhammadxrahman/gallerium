import * as satellite from "satellite.js";
import type { Observer } from "./coordinates";

export interface SatellitePosition {
  name: string;
  ra: number;
  dec: number;
  altitude: number; // km above Earth
  azimuth?: number;      // topocentric, degrees (only set when an observer is given)
  elevationAngle?: number; // topocentric altitude above horizon, degrees
  sunlit?: boolean;        // lit by the Sun (vs in Earth's shadow); set when sunDir given
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const EARTH_RADIUS_KM = 6378.14;

// Is a satellite at ECI position S (km) lit by the Sun (unit direction U, ECI)?
// Cylindrical-shadow model: it's in eclipse only when it's on the anti-sun side
// AND within one Earth radius of the Sun–Earth axis. Good enough to tell a visible
// twilight pass from one that's in the Earth's shadow.
export function isSatelliteSunlit(S: Vec3, U: Vec3): boolean {
  const dot = S.x * U.x + S.y * U.y + S.z * U.z;
  if (dot >= 0) return true; // sunward side — always lit
  const px = S.x - dot * U.x;
  const py = S.y - dot * U.y;
  const pz = S.z - dot * U.z;
  return Math.sqrt(px * px + py * py + pz * pz) > EARTH_RADIUS_KM;
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
  observer?: Observer,
  sunDirEci?: Vec3
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

    const sunlit = sunDirEci
      ? isSatelliteSunlit(positionEci, sunDirEci)
      : undefined;

    return {
      name: tle.name,
      ra,
      dec,
      altitude: altitudeKm,
      azimuth,
      elevationAngle,
      sunlit,
    };
  } catch {
    return null;
  }
}

export function getVisibleSatellites(
  tles: TLE[],
  date: Date,
  observer?: Observer,
  sunDirEci?: Vec3
): SatellitePosition[] {
  return tles
    .map(tle => getSatellitePosition(tle, date, observer, sunDirEci))
    .filter((s): s is SatellitePosition => s !== null);
}