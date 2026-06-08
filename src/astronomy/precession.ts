// Precession of the equinoxes: the catalog stores star positions at the J2000
// epoch, but the equatorial frame drifts ~50"/yr, so by the late 2020s positions
// are already ~0.3–0.4° off and growing. This rotates J2000 RA/Dec to the date.
// Rigorous formulation from Meeus, "Astronomical Algorithms" ch. 21.

function toRad(d: number): number {
  return d * (Math.PI / 180);
}
function toDeg(r: number): number {
  return r * (180 / Math.PI);
}
function normDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}
function getJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function precessFromJ2000(
  ra0Deg: number,
  dec0Deg: number,
  date: Date
): { ra: number; dec: number } {
  const t = (getJulianDate(date) - 2451545.0) / 36525; // centuries from J2000

  // Precession angles in arcseconds (starting epoch = J2000, so the T-terms drop).
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) / 3600;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) / 3600;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) / 3600;

  const ra0 = toRad(ra0Deg);
  const dec0 = toRad(dec0Deg);
  const zetaR = toRad(zeta);
  const thetaR = toRad(theta);

  const A = Math.cos(dec0) * Math.sin(ra0 + zetaR);
  const B =
    Math.cos(thetaR) * Math.cos(dec0) * Math.cos(ra0 + zetaR) -
    Math.sin(thetaR) * Math.sin(dec0);
  const C =
    Math.sin(thetaR) * Math.cos(dec0) * Math.cos(ra0 + zetaR) +
    Math.cos(thetaR) * Math.sin(dec0);

  const ra = normDeg(toDeg(Math.atan2(A, B)) + z);
  const dec = toDeg(Math.asin(Math.max(-1, Math.min(1, C))));
  return { ra, dec };
}
