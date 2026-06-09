// A short haptic tick when the AR crosshair locks onto a guided target. The decision is
// a pure state machine with hysteresis (pulse once on entering the lock zone, re-arm only
// after leaving a wider zone) so it fires exactly once per lock, not every frame.

export const LOCK_DEG = 2.5; // within this of the crosshair counts as "locked on"
export const REARM_DEG = 4; // must drift beyond this before another pulse can fire

export function lockHaptic(
  distanceDeg: number,
  armed: boolean
): { pulse: boolean; armed: boolean } {
  if (armed && distanceDeg < LOCK_DEG) return { pulse: true, armed: false };
  if (!armed && distanceDeg > REARM_DEG) return { pulse: false, armed: true };
  return { pulse: false, armed };
}

// Fire a short vibration if the device supports it (no-op otherwise).
export function vibrate(ms = 15): void {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(ms);
  }
}
