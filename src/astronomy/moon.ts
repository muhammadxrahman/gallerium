export interface MoonPosition {
  ra: number;   // degrees (geocentric)
  dec: number;  // degrees (geocentric)
  phase: number; // 0-1 illuminated fraction (0=new, 1=full); same value as illumination
  illumination: number; // 0-1 fraction of the disc lit
  waxing: boolean; // true while growing (new→full), false while shrinking (full→new)
  distanceKm: number; // Earth–Moon distance, for topocentric parallax
}

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

export function getMoonPosition(date: Date): MoonPosition {
  const jd = getJulianDate(date);
  const T = (jd - 2451545.0) / 36525; // centuries since J2000

  // Moon's mean longitude
  const L0 = normalizeAngle(218.3164477 + 481267.88123421 * T);

  // Moon's mean anomaly
  const M = normalizeAngle(134.9633964 + 477198.8675055 * T);

  // Sun's mean anomaly
  const Ms = normalizeAngle(357.5291092 + 35999.0502909 * T);

  // Moon's argument of latitude
  const F = normalizeAngle(93.2720950 + 483202.0175233 * T);

  // Moon's mean elongation
  const D = normalizeAngle(297.8501921 + 445267.1114034 * T);

  // Convert to radians for trig
  const Mrad  = toRad(M);
  const Msrad = toRad(Ms);
  const Frad  = toRad(F);
  const Drad  = toRad(D);

  // Longitude corrections (degrees) — main periodic terms from Jean Meeus
const dL =
    6.288774 * Math.sin(Mrad) +
    1.274027 * Math.sin(2 * Drad - Mrad) +
    0.658314 * Math.sin(2 * Drad) +
    0.213618 * Math.sin(2 * Mrad) +
   -0.185116 * Math.sin(Msrad) +
   -0.114332 * Math.sin(2 * Frad) +
    0.058793 * Math.sin(2 * Drad - 2 * Mrad) +
    0.057066 * Math.sin(2 * Drad - Mrad - Msrad) +
    0.053322 * Math.sin(2 * Drad + Mrad) +
    0.045758 * Math.sin(2 * Drad - Msrad) +
   -0.040923 * Math.sin(Mrad - Msrad) +
   -0.034720 * Math.sin(Drad) +
   -0.030383 * Math.sin(Mrad + Msrad) +
    0.015327 * Math.sin(2 * Drad - 2 * Frad) +
   -0.012528 * Math.sin(Mrad + 2 * Frad) +
    0.010980 * Math.sin(Mrad - 2 * Frad);

  // Latitude corrections (degrees)
const dB =
    5.128122 * Math.sin(Frad) +
    0.280602 * Math.sin(Mrad + Frad) +
    0.277693 * Math.sin(Mrad - Frad) +
    0.173237 * Math.sin(2 * Drad - Frad) +
    0.055413 * Math.sin(2 * Drad - Mrad + Frad) +
    0.046271 * Math.sin(2 * Drad - Mrad - Frad) +
    0.032573 * Math.sin(2 * Drad + Frad) +
    0.017198 * Math.sin(2 * Mrad + Frad) +
    0.009266 * Math.sin(2 * Drad + Mrad - Frad) +
    0.008822 * Math.sin(2 * Mrad - Frad);

  // Earth–Moon distance (km) — main periodic terms from Meeus table 47.A.
  const distanceKm =
    385000.56 -
    20905.355 * Math.cos(Mrad) -
    3699.111 * Math.cos(2 * Drad - Mrad) -
    2955.968 * Math.cos(2 * Drad) -
    569.925 * Math.cos(2 * Mrad) +
    48.888 * Math.cos(Msrad) +
    246.158 * Math.cos(2 * Drad - 2 * Mrad) -
    152.138 * Math.cos(2 * Drad - Mrad - Msrad) -
    170.733 * Math.cos(2 * Drad + Mrad) -
    204.586 * Math.cos(2 * Drad - Msrad) -
    129.620 * Math.cos(Mrad - Msrad) +
    108.743 * Math.cos(Drad) +
    104.755 * Math.cos(Mrad + Msrad);

  // Ecliptic longitude and latitude
  const lambda = normalizeAngle(L0 + dL);
  const beta   = dB;

  // Convert ecliptic to equatorial
  const eps = 23.439291 - 0.013004 * T; // obliquity of ecliptic
  const epsRad = toRad(eps);
  const lamRad = toRad(lambda);
  const betRad = toRad(beta);

  const x = Math.cos(betRad) * Math.cos(lamRad);
  const y = Math.cos(epsRad) * Math.cos(betRad) * Math.sin(lamRad) -
            Math.sin(epsRad) * Math.sin(betRad);
  const z = Math.sin(epsRad) * Math.cos(betRad) * Math.sin(lamRad) +
            Math.cos(epsRad) * Math.sin(betRad);

  const ra  = normalizeAngle(toDeg(Math.atan2(y, x)));
  const dec = toDeg(Math.asin(z));

  // Phase angle — elongation of Moon from Sun.
  // 0°→360° as the Moon moves new→full→new. Elongation < 180° means the Moon
  // leads the Sun (waxing); > 180° means it trails (waning).
  const elongation = normalizeAngle(lambda - (280.4665 + 36000.7698 * T));
  const phase = (1 - Math.cos(toRad(elongation))) / 2;
  const illumination = phase;
  const waxing = elongation < 180;

  return { ra, dec, phase, illumination, waxing, distanceKm };
}