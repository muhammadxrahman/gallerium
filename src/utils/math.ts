export function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function toDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function degToRad(deg: number): number {
  return deg * (Math.PI / 180);
}