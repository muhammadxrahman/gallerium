export interface EquatorialCoords {
  ra: number;  // Right Ascension in degrees (0-360)
  dec: number; // Declination in degrees (-90 to 90)
}

export interface HorizontalCoords {
  az: number;  // Azimuth in degrees (0-360, North=0, East=90)
  alt: number; // Altitude in degrees (-90 to 90)
}

export interface Observer {
  latitude: number;  // degrees
  longitude: number; // degrees
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

export function equatorialToHorizontal(
  coords: EquatorialCoords,
  observer: Observer,
  lst: number // Local Sidereal Time in degrees
): HorizontalCoords {
  // Hour angle: how far the star has rotated past the meridian
  const ha = toRad(normalizeAngle(lst - coords.ra));
  const dec = toRad(coords.dec);
  const lat = toRad(observer.latitude);

  const sinAlt =
    Math.sin(dec) * Math.sin(lat) +
    Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(sinAlt);

  const cosAz =
    (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) /
    (Math.cos(alt) * Math.cos(lat));
  const clampedCosAz = Math.max(-1, Math.min(1, cosAz));
  let az = toDeg(Math.acos(clampedCosAz));

  // Quadrant fix: if hour angle is in eastern sky, flip azimuth
  if (Math.sin(ha) > 0) az = 360 - az;

  return {
    az: normalizeAngle(az),
    alt: toDeg(alt),
  };
}