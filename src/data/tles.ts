import { cacheGet, cacheSet } from "../utils/cache";
import { parseTLEs, type TLE } from "../astronomy/satellites";

const CACHE_KEY = "tle-data";
const CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// CelesTrak's direct TLE URLs
const VISUAL_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle";

export async function loadTLEs(): Promise<TLE[]> {
  try {
    const cached = await cacheGet<TLE[]>(CACHE_KEY, CACHE_AGE_MS);
    if (cached && cached.length > 0) return cached;
  } catch (e) {
    console.warn("TLE cache read failed, fetching fresh:", e);
  }

  const response = await fetch(VISUAL_URL);
  if (!response.ok) throw new Error(`Failed to fetch TLEs: ${response.status}`);

  const raw = await response.text();
  const tles = parseTLEs(raw);

  try {
    await cacheSet(CACHE_KEY, tles);
  } catch (e) {
    console.warn("TLE cache write failed:", e);
  }

  return tles;
}