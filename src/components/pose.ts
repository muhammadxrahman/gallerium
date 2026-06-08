// Device orientation (alpha/beta/gamma) → where the back of the phone points,
// expressed as horizontal coordinates (azimuth/altitude). Uses the standard
// device→world rotation matrix R = Rz(alpha)·Rx(beta)·Ry(gamma) (W3C
// DeviceOrientation), world frame East-North-Up. The viewing direction is the
// back camera = device −Z, so its world vector is the negated 3rd column of R.
//
// Crucially, altitude = asin(−cos(beta)·cos(gamma)) depends only on the tilt, not
// the compass — so it's reliable on every device and correctly reaches the zenith
// when the phone is tipped back (the old `90 − |beta|` could not point overhead and
// ignored roll entirely).

export interface DeviceAngles {
  alpha: number; // around Z (compass), degrees
  beta: number; // front-back tilt, degrees
  gamma: number; // left-right roll, degrees
}

export interface Horizontal {
  azimuth: number; // 0..360, 0 = north, clockwise
  altitude: number; // -90..90
}

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function poseToHorizontal({ alpha, beta, gamma }: DeviceAngles): Horizontal {
  const cA = Math.cos(alpha * D2R), sA = Math.sin(alpha * D2R);
  const cB = Math.cos(beta * D2R), sB = Math.sin(beta * D2R);
  const cG = Math.cos(gamma * D2R), sG = Math.sin(gamma * D2R);

  // Third column of R (device +Z in world coords).
  const r02 = cA * sG + cG * sA * sB;
  const r12 = sA * sG - cA * cG * sB;
  const r22 = cB * cG;

  // Back-camera direction = −Z device, in East-North-Up.
  const east = -r02;
  const north = -r12;
  const up = -r22;

  const altitude = Math.asin(Math.max(-1, Math.min(1, up))) * R2D;
  let azimuth = Math.atan2(east, north) * R2D; // from north, clockwise
  azimuth = ((azimuth % 360) + 360) % 360;

  return { azimuth, altitude };
}
