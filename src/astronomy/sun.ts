export interface SunPosition {
  ra: number;  // degrees
  dec: number; // degrees
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

// Geocentric apparent position of the Sun (Meeus, low-precision solar theory).
// Accurate to ~0.01° — far better than this app's ±5° visual tolerance.
export function getSunPosition(date: Date): SunPosition {
  const T = (getJulianDate(date) - 2451545.0) / 36525; // centuries since J2000

  // Geometric mean longitude and mean anomaly
  const L0 = normalizeAngle(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = normalizeAngle(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mrad = toRad(M);

  // Equation of the center
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);

  const trueLon = L0 + C;

  // Apparent longitude (corrected for nutation + aberration)
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLon - 0.00569 - 0.00478 * Math.sin(toRad(omega));

  // Obliquity of the ecliptic (with nutation correction)
  const eps = 23.439291 - 0.0130042 * T + 0.00256 * Math.cos(toRad(omega));

  const lamRad = toRad(lambda);
  const epsRad = toRad(eps);

  const ra = normalizeAngle(
    toDeg(Math.atan2(Math.cos(epsRad) * Math.sin(lamRad), Math.cos(lamRad)))
  );
  const dec = toDeg(Math.asin(Math.sin(epsRad) * Math.sin(lamRad)));

  return { ra, dec };
}
