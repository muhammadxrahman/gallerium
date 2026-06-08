// Atmospheric refraction lifts objects toward the zenith — strongest at the
// horizon (~0.57°) and ~0 overhead. This is why the Sun is still visible when it's
// geometrically just below the horizon. Bennett's 1982 formula (apparent from true
// altitude), accurate to ~0.07' — far better than this app's visual tolerance.

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Given a geometric (true) altitude in degrees, return the apparent altitude.
export function refractedAltitude(trueAltDeg: number): number {
  // Below ~-2° refraction is both negligible and outside the formula's domain.
  if (trueAltDeg < -2) return trueAltDeg;
  const h = trueAltDeg;
  const rArcmin = 1 / Math.tan(toRad(h + 7.31 / (h + 4.4)));
  return h + rArcmin / 60;
}
