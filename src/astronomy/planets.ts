export interface Planet {
  name: string;
  ra: number;  // degrees
  dec: number; // degrees
  magnitude: number;
}

// Orbital elements at J2000.0 epoch
// [a, e, i, L, longPeri, longNode]
// a = semi-major axis (AU)
// e = eccentricity
// i = inclination (deg)
// L = mean longitude (deg)
// longPeri = longitude of perihelion (deg)
// longNode = longitude of ascending node (deg)

const ORBITAL_ELEMENTS: Record<string, number[]> = {
  Mercury: [0.38709927, 0.20563593, 7.00497902,  252.25032350,  77.45779628,  48.33076593],
  Venus:   [0.72333566, 0.00677672, 3.39467605,  181.97909950, 131.60246718,  76.67984255],
  Mars:    [1.52371034, 0.09339410, 1.84969142,   -4.55343205, -23.94362959,  49.55953891],
  Jupiter: [5.20288700, 0.04838624, 1.30439695,   34.39644051,  14.72847983, 100.47390909],
  Saturn:  [9.53667594, 0.05386179, 2.48599187,   49.95424423,  92.59887831, 113.66242448],
};

// Rates of change per century
const ORBITAL_RATES: Record<string, number[]> = {
  Mercury: [0.00000037,  0.00001906, -0.00594749,  149472.67411175,  0.16047689, -0.12534081],
  Venus:   [0.00000390, -0.00004107, -0.00078890,   58517.81538729,  0.00268329, -0.27769418],
  Mars:    [0.00001847,  0.00007882, -0.00813131,   19140.30268499,  0.44441088, -0.29257343],
  Jupiter: [-0.00011607, -0.00013253, -0.00183714,   3034.74612775,  0.21252668,  0.20469106],
  Saturn:  [-0.00125060, -0.00050991,  0.00193609,   1222.49362201, -0.41897216, -0.28867794],
};

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function toDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function getJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function solveKepler(Mdeg: number, e: number): number {
  // Solve Kepler's equation M = E - e*sin(E) by Newton's method.
  // M and E must be in the SAME units; we work in radians (e*sin(E) is radians),
  // then return E in degrees for the callers. Mixing degrees with the radian-valued
  // e*sin(E) term under-corrects the eccentric anomaly and skews positions by
  // several degrees, so keep the whole iteration in radians.
  const M = toRad(Mdeg);
  let E = M;
  for (let i = 0; i < 50; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return toDeg(E);
}

function getPlanetEclipticCoords(name: string, date: Date): [number, number, number] {
  const jd = getJulianDate(date);
  const T = (jd - 2451545.0) / 36525; // Centuries since J2000

  const el = ORBITAL_ELEMENTS[name];
  const er = ORBITAL_RATES[name];

  const a    = el[0] + er[0] * T;
  const e    = el[1] + er[1] * T;
  const i    = el[2] + er[2] * T;
  const L    = el[3] + er[3] * T;
  const wBar = el[4] + er[4] * T; // longitude of perihelion
  const W    = el[5] + er[5] * T; // longitude of ascending node

  const w = wBar - W;             // argument of perihelion
  const M = normalizeAngle(L - wBar); // mean anomaly

  const E = solveKepler(M, e);    // eccentric anomaly

  // Heliocentric coords in orbital plane
  const xOrbit = a * (Math.cos(toRad(E)) - e);
  const yOrbit = a * Math.sqrt(1 - e * e) * Math.sin(toRad(E));

  // Rotate to ecliptic plane
  const cosW = Math.cos(toRad(W)), sinW = Math.sin(toRad(W));
  const cosw = Math.cos(toRad(w)), sinw = Math.sin(toRad(w));
  const cosi = Math.cos(toRad(i)), sini = Math.sin(toRad(i));

  const x = (cosW * cosw - sinW * sinw * cosi) * xOrbit +
            (-cosW * sinw - sinW * cosw * cosi) * yOrbit;
  const y = (sinW * cosw + cosW * sinw * cosi) * xOrbit +
            (-sinW * sinw + cosW * cosw * cosi) * yOrbit;
  const z = (sinw * sini) * xOrbit + (cosw * sini) * yOrbit;

  return [x, y, z];
}

function getEarthCoords(date: Date): [number, number, number] {
  const jd = getJulianDate(date);
  const T = (jd - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T;
  const M0 = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(toRad(M0))
          + (0.019993 - 0.000101 * T) * Math.sin(toRad(2 * M0))
          + 0.000289 * Math.sin(toRad(3 * M0));
  const sunLon = L0 + C;
  const R = 1.000001018 * (1 - 0.016708634 * 0.016708634) /
            (1 + 0.016708634 * Math.cos(toRad(M0 + C)));

  const x = R * Math.cos(toRad(sunLon + 180));
  const y = R * Math.sin(toRad(sunLon + 180));
  return [x, y, 0];
}

export function getPlanetPosition(name: string, date: Date): Planet {
  const [px, py, pz] = getPlanetEclipticCoords(name, date);
  const [ex, ey, ez] = getEarthCoords(date);

  // Geocentric ecliptic coords
  const dx = px - ex;
  const dy = py - ey;
  const dz = pz - ez;

  // Convert ecliptic to equatorial (obliquity ~23.439°)
  const eps = toRad(23.439);
  const x = dx;
  const y = dy * Math.cos(eps) - dz * Math.sin(eps);
  const z = dy * Math.sin(eps) + dz * Math.cos(eps);

  const ra  = normalizeAngle(toDeg(Math.atan2(y, x)));
  const dec = toDeg(Math.asin(z / Math.sqrt(x * x + y * y + z * z)));

  return { name, ra, dec, magnitude: 0 }; // magnitude placeholder for now
}

export function getAllPlanets(date: Date): Planet[] {
  return Object.keys(ORBITAL_ELEMENTS).map(name => getPlanetPosition(name, date));
}