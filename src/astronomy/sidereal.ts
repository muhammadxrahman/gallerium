export function getJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function getGMST(date: Date): number {
  const jd = getJulianDate(date);
  const T = (jd - 2451545.0) / 36525;
  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    T * T * 0.000387933 -
    (T * T * T) / 38710000;
  return ((gmst % 360) + 360) % 360;
}

export function getLST(date: Date, longitude: number): number {
  const gmst = getGMST(date);
  return ((gmst + longitude) % 360 + 360) % 360;
}