// The idle status-line text, extracted from main.ts so the decision is pure and
// testable. It surfaces the two persistent conditions worth warning about — running
// fully offline (no catalog or TLEs) and stale satellite data — and is otherwise blank.

export interface TleMeta {
  fromCache: boolean;
  ageMs: number | null;
}

const DAY_MS = 86_400_000;
export const STALE_TLE_DAYS = 3; // TLEs drift; warn once they're this old

// Persistent status when idle: offline-degraded, stale-satellite warning, or clear.
export function idleStatus(hasStars: boolean, hasTles: boolean, tle: TleMeta): string {
  if (!hasStars && !hasTles) {
    return "Offline: showing planets & Moon only.";
  }
  if (tle.fromCache && tle.ageMs !== null) {
    const days = tle.ageMs / DAY_MS;
    if (days >= STALE_TLE_DAYS) {
      return `Satellite data ${Math.round(days)} days old — Layers ▸ Refresh`;
    }
  }
  return "";
}
