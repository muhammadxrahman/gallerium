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
  // alpha: compass heading (0-360, 0=North)
  // beta: front-back tilt (-180 to 180)
  // gamma: left-right tilt (-90 to 90)

  // Altitude needs beta; bail if it's unavailable.
  if (e.beta === null) return;

  // Compass heading. Two sources, two conventions:
  //  - iOS Safari: webkitCompassHeading is degrees CLOCKWISE from true north.
  //    (iOS `alpha` is relative to the device's startup orientation, NOT north,
  //    so it must not be used as a heading.)
  //  - deviceorientationabsolute (Android/desktop): alpha is degrees
  //    COUNTERclockwise from north, so heading = 360 - alpha.
  const compassHeading = (e as unknown as { webkitCompassHeading?: number })
    .webkitCompassHeading;

  let azimuth: number | null = null;
  if (typeof compassHeading === "number" && !isNaN(compassHeading)) {
    azimuth = compassHeading;
  } else if (e.alpha !== null) {
    azimuth = (360 - e.alpha) % 360;
  }
  if (azimuth === null) return; // no usable heading this frame

  // Convert phone tilt to sky altitude
  // When holding phone flat face up: beta~0, pointing at zenith
  // When holding phone vertical: beta~90, pointing at horizon
  const altitude = 90 - Math.abs(e.beta);

  orientation = {
    azimuth: ((azimuth % 360) + 360) % 360,
    altitude: Math.max(-90, Math.min(90, altitude)),
  };
}