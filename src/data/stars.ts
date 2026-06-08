import { cacheGet, cacheSet } from "../utils/cache";
import { fetchWithFallback } from "../utils/fetchWithFallback";

export interface Star {
  id: number;
  ra: number;       // degrees
  dec: number;      // degrees
  magnitude: number;
  colorIndex: number; // B-V color index, used for star color
  name?: string;    // only bright named stars have this
}

// Primary (GitHub raw) + jsDelivr CDN mirror of the same file, for resilience.
const HYG_URLS = [
  "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv",
  "https://cdn.jsdelivr.net/gh/astronexus/HYG-Database@main/hyg/CURRENT/hygdata_v41.csv",
];
const CACHE_KEY = "hyg-catalog";
const CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

// Only load stars visible to naked eye + a bit more
const MAX_MAGNITUDE = 6.5;

export function parseCSV(raw: string): Star[] {
  const lines = raw.split("\n");
  const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());

  const idx = {
    id:    headers.indexOf("id"),
    ra:    headers.indexOf("ra"),
    dec:   headers.indexOf("dec"),
    mag:   headers.indexOf("mag"),
    ci:    headers.indexOf("ci"),
    proper: headers.indexOf("proper"),
  };

  const stars: Star[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 5) continue;

    // HYG row id 0 is the Sun ("Sol") sitting at RA/Dec 0,0 with mag -26.7. It is
    // NOT a fixed star — the real Sun is computed in astronomy/sun.ts — so skip it,
    // otherwise it renders as a giant bright dot stuck at the vernal equinox point.
    const id = parseInt(cols[idx.id]);
    if (id === 0) continue;

    const mag = parseFloat(cols[idx.mag]);
    if (isNaN(mag) || mag > MAX_MAGNITUDE) continue;

    const ra = parseFloat(cols[idx.ra]) * 15; // HYG stores RA in hours, convert to degrees
    const dec = parseFloat(cols[idx.dec]);
    const ci = parseFloat(cols[idx.ci]);
    const name = cols[idx.proper]?.trim() || undefined;

    if (isNaN(ra) || isNaN(dec)) continue;

    stars.push({
      id,
      ra,
      dec,
      magnitude: mag,
      colorIndex: isNaN(ci) ? 0 : ci,
      name: name || undefined,
    });
  }

  return stars;
}

export async function loadStars(force = false): Promise<Star[]> {
  // Try cache first (unless forcing a refresh), but don't let cache errors block.
  if (!force) {
    try {
      const cached = await cacheGet<Star[]>(CACHE_KEY, CACHE_AGE_MS);
      if (cached && cached.length > 0) return cached;
    } catch (e) {
      console.warn("Cache read failed, fetching fresh:", e);
    }
  }

  // Fetch fresh, falling back across mirrors.
  const response = await fetchWithFallback(HYG_URLS);
  const raw = await response.text();
  const stars = parseCSV(raw);

  try {
    await cacheSet(CACHE_KEY, stars);
  } catch (e) {
    console.warn("Cache write failed:", e);
  }

  return stars;
}