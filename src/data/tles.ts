import { cacheGet, cacheSet, cacheGetEntry } from "../utils/cache";
import { fetchWithFallback } from "../utils/fetchWithFallback";
import { parseTLEs, type TLE } from "../astronomy/satellites";

const CACHE_KEY = "tle-data";
const CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// CelesTrak visual group, with the .com alias as a fallback host.
const VISUAL_URLS = [
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle",
  "https://www.celestrak.com/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle",
];

export interface TleMeta {
  fromCache: boolean;
  ageMs: number | null; // age of the data when served from cache
}

let lastMeta: TleMeta = { fromCache: false, ageMs: null };

export function getTleMeta(): TleMeta {
  return lastMeta;
}

export async function loadTLEs(force = false): Promise<TLE[]> {
  if (!force) {
    try {
      const cached = await cacheGet<TLE[]>(CACHE_KEY, CACHE_AGE_MS);
      if (cached && cached.length > 0) {
        const entry = await cacheGetEntry<TLE[]>(CACHE_KEY);
        lastMeta = { fromCache: true, ageMs: entry ? Date.now() - entry.timestamp : null };
        return cached;
      }
    } catch (e) {
      console.warn("TLE cache read failed, fetching fresh:", e);
    }
  }

  const response = await fetchWithFallback(VISUAL_URLS);
  const raw = await response.text();
  const tles = parseTLEs(raw);

  try {
    await cacheSet(CACHE_KEY, tles);
  } catch (e) {
    console.warn("TLE cache write failed:", e);
  }

  lastMeta = { fromCache: false, ageMs: 0 };
  return tles;
}
