// Optic field-of-view presets + the geometry to draw a "true field" ring in the AR view.
// Shows how much of the sky a given binocular/telescope shows around where you're aiming.

export interface Optic {
  label: string;
  fov: number; // true field of view in degrees (0 = off)
}

export const OPTICS: Optic[] = [
  { label: "Off", fov: 0 },
  { label: "7×50 binoculars", fov: 6.4 },
  { label: "10×50 binoculars", fov: 5.0 },
  { label: "15×70 binoculars", fov: 4.4 },
  { label: "Telescope · wide", fov: 1.5 },
  { label: "Telescope · medium", fov: 0.8 },
  { label: "Telescope · narrow", fov: 0.4 },
];

export function opticLabel(fov: number): string {
  return OPTICS.find((o) => o.fov === fov)?.label ?? `${fov}°`;
}

// Pixel radius of an optic's true field on the AR (gnomonic) view, where an object θ° off
// the aim point sits tan(θ)·focal pixels out. `viewFovDeg` is the current AR field; an
// optic field equal to it lands exactly at the screen edge (minDimPx/2).
export function opticRingRadiusPx(fovDeg: number, viewFovDeg: number, minDimPx: number): number {
  if (fovDeg <= 0) return 0;
  const focal = minDimPx / 2 / Math.tan((viewFovDeg / 2) * (Math.PI / 180));
  return Math.tan((fovDeg / 2) * (Math.PI / 180)) * focal;
}
