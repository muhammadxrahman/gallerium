import * as satellite from "satellite.js";

export interface SatellitePosition {
  name: string;
  ra: number;
  dec: number;
  altitude: number; // km above Earth
  azimuth?: number;
  elevationAngle?: number;
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
  date: Date
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
    const altitudeKm = geodetic.height; // convert from Earth radii to km

    // ECI to RA/Dec
    const r = Math.sqrt(
        positionEci.x ** 2 +
        positionEci.y ** 2 +
        positionEci.z ** 2
        );

    if (isNaN(r) || r === 0) return null;

    const dec = Math.asin(positionEci.z / r) * (180 / Math.PI);
    const ra = ((Math.atan2(positionEci.y, positionEci.x) * (180 / Math.PI)) + 360) % 360;

    return {
      name: tle.name,
      ra,
      dec,
      altitude: altitudeKm,
    };
  } catch {
    return null;
  }
}

export function getVisibleSatellites(
  tles: TLE[],
  date: Date
): SatellitePosition[] {
  return tles
    .map(tle => getSatellitePosition(tle, date))
    .filter((s): s is SatellitePosition => s !== null);
}