import { poseToHorizontal } from "./pose";

export interface DeviceOrientation {
  azimuth: number;  // compass heading, 0-360
  altitude: number; // tilt, -90 to 90
}

let orientation: DeviceOrientation = { azimuth: 0, altitude: 45 };
let listening = false;

export function getOrientation(): DeviceOrientation {
  return orientation;
}

export function isListening(): boolean {
  return listening;
}

export async function requestOrientationPermission(): Promise<boolean> {
  // iOS 13+ requires explicit permission
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    // @ts-ignore
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    try {
      // @ts-ignore
      const result = await DeviceOrientationEvent.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }
  // Android and desktop — permission not required
  return true;
}

export function startOrientationTracking(): void {
  if (listening) return;

  window.addEventListener("deviceorientationabsolute", handleOrientation, true);
  window.addEventListener("deviceorientation", handleOrientation, true);
  listening = true;
}

export function stopOrientationTracking(): void {
  window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
  window.removeEventListener("deviceorientation", handleOrientation, true);
  listening = false;
}

function handleOrientation(e: DeviceOrientationEvent): void {
  // alpha: rotation about Z (compass); beta: front-back tilt; gamma: left-right roll.

  // Altitude needs the tilt (beta); gamma defaults to 0 if the device omits it.
  if (e.beta === null) return;
  const pose = poseToHorizontal({ alpha: e.alpha ?? 0, beta: e.beta, gamma: e.gamma ?? 0 });

  // Altitude comes from the full rotation matrix — correct for overhead/behind and
  // for roll, unlike the old `90 - |beta|`.
  const altitude = pose.altitude;

  // Azimuth (heading). Two sources, two conventions:
  //  - iOS Safari: webkitCompassHeading is degrees CLOCKWISE from true north.
  //    (iOS `alpha` is relative to the device's startup orientation, not north.)
  //  - deviceorientationabsolute (Android/desktop): alpha is north-referenced, so
  //    the rotation-matrix azimuth is already correct.
  const compassHeading = (e as unknown as { webkitCompassHeading?: number })
    .webkitCompassHeading;

  let azimuth: number;
  if (typeof compassHeading === "number" && !isNaN(compassHeading)) {
    azimuth = compassHeading;
  } else if (e.alpha !== null) {
    azimuth = pose.azimuth;
  } else {
    azimuth = orientation.azimuth; // keep the last heading if none is available
  }

  orientation = {
    azimuth: ((azimuth % 360) + 360) % 360,
    altitude: Math.max(-90, Math.min(90, altitude)),
  };
}