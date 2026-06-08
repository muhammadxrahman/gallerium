// Topocentric parallax: nearby bodies (chiefly the Moon) are seen in a slightly
// different direction from the Earth's surface than from its center — up to ~1°
// for the Moon, largest near the horizon, zero at the zenith. Meeus ch. 40.
// Earth flattening is ignored (ρ≈1), which is well within our visual tolerance.

const EARTH_RADIUS_KM = 6378.14;

function toRad(d: number): number {
  return d * (Math.PI / 180);
}
function toDeg(r: number): number {
  return r * (180 / Math.PI);
}
function normDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

// Convert a geocentric RA/Dec to topocentric for an observer at `latDeg`, given
// the body's distance and the Local Sidereal Time (deg).
export function topocentricCorrection(
  raDeg: number,
  decDeg: number,
  distanceKm: number,
  latDeg: number,
  lstDeg: number
): { ra: number; dec: number } {
  const sinPi = EARTH_RADIUS_KM / distanceKm; // sine of the horizontal parallax
  const lat = toRad(latDeg);
  const rhoSin = Math.sin(lat); // ρ·sin φ' (flattening ignored)
  const rhoCos = Math.cos(lat); // ρ·cos φ'

  const dec = toRad(decDeg);
  const H = toRad(normDeg(lstDeg - raDeg)); // local hour angle

  const cosDec = Math.cos(dec);
  const deltaAlpha = Math.atan2(
    -rhoCos * sinPi * Math.sin(H),
    cosDec - rhoCos * sinPi * Math.cos(H)
  );

  const decTopo = Math.atan2(
    (Math.sin(dec) - rhoSin * sinPi) * Math.cos(deltaAlpha),
    cosDec - rhoCos * sinPi * Math.cos(H)
  );

  return { ra: normDeg(raDeg + toDeg(deltaAlpha)), dec: toDeg(decTopo) };
}
