// Human-readable equatorial coordinates for the info card's "RA/Dec" display mode.
// RA in hours/minutes, Dec in signed degrees/arcminutes. Pure + tested.

function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// Right ascension (degrees) → "Hh Mm", with the 60-minute carry handled.
export function formatRA(deg: number): string {
  let totalMin = Math.round((norm360(deg) / 15) * 60); // minutes of time
  totalMin = ((totalMin % 1440) + 1440) % 1440; // wrap at 24h
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

// Declination (degrees) → "±D° M′", with the 60-arcminute carry handled.
export function formatDec(deg: number): string {
  const sign = deg < 0 ? "-" : "+";
  const totalMin = Math.round(Math.abs(deg) * 60);
  const d = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${sign}${d}° ${m}′`;
}
