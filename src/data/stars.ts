import { cacheGet, cacheSet } from "../utils/cache";

export interface Star {
  id: number;
  ra: number;       // degrees
  dec: number;      // degrees
  magnitude: number;
  colorIndex: number; // B-V color index, used for star color
  name?: string;    // only bright named stars have this
}

const HYG_URL = "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv";
const CACHE_KEY = "hyg-catalog";
const CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

// Only load stars visible to naked eye + a bit more
const MAX_MAGNITUDE = 6.5;

function parseCSV(raw: string): Star[] {
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

    const mag = parseFloat(cols[idx.mag]);
    if (isNaN(mag) || mag > MAX_MAGNITUDE) continue;

    const ra = parseFloat(cols[idx.ra]) * 15; // HYG stores RA in hours, convert to degrees
    const dec = parseFloat(cols[idx.dec]);
    const ci = parseFloat(cols[idx.ci]);
    const name = cols[idx.proper]?.trim() || undefined;

    if (isNaN(ra) || isNaN(dec)) continue;

    stars.push({
      id: parseInt(cols[idx.id]),
      ra,
      dec,
      magnitude: mag,
      colorIndex: isNaN(ci) ? 0 : ci,
      name: name || undefined,
    });
  }

  return stars;
}

export async function loadStars(): Promise<Star[]> {
  // Try cache first, but don't let cache errors block loading
  try {
    const cached = await cacheGet<Star[]>(CACHE_KEY, CACHE_AGE_MS);
    if (cached && cached.length > 0) return cached;
  } catch (e) {
    console.warn("Cache read failed, fetching fresh:", e);
  }

  // Fetch fresh
  const response = await fetch(HYG_URL);
  if (!response.ok) throw new Error(`Failed to fetch star catalog: ${response.status}`);

  const raw = await response.text();
  const stars = parseCSV(raw);

  try {
    await cacheSet(CACHE_KEY, stars);
  } catch (e) {
    console.warn("Cache write failed:", e);
  }

  return stars;
}