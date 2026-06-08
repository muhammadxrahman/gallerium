// The single source of "sky time". Live by default (real wall clock); when the user
// scrubs to a date/time it freezes there so the sky holds still for planning. Every
// position computation reads getSkyTime(), so time travel is automatic everywhere.

let frozen: Date | null = null;

export function getSkyTime(): Date {
  return frozen ? new Date(frozen) : new Date();
}

export function isLive(): boolean {
  return frozen === null;
}

// Freeze the sky at a specific instant.
export function setSkyTime(date: Date): void {
  frozen = new Date(date.getTime());
}

// Shift the (frozen, or now-anchored) sky time by some milliseconds.
export function shiftSkyTime(deltaMs: number): void {
  const base = frozen ?? new Date();
  frozen = new Date(base.getTime() + deltaMs);
}

// Return to following the real clock.
export function goLive(): void {
  frozen = null;
}
