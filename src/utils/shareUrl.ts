// Encode/decode a shareable view in a URL query string: observer location, the frozen
// sky time, zoom, and an optional guide target (a search-index id). Pure — the caller
// assembles the full URL (origin + path) and applies the parsed state. Missing or invalid
// fields are dropped, so a partial or hand-edited link still opens gracefully.

export interface ShareState {
  latitude?: number;
  longitude?: number;
  time?: number; // epoch ms; omit for "live / now"
  zoom?: number;
  target?: string; // search-index id, e.g. "planet:Jupiter"
}

function finiteNum(v: string | null): number | undefined {
  if (v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function encodeShareState(s: ShareState): string {
  const p = new URLSearchParams();
  // Location is all-or-nothing (both coordinates or neither).
  if (s.latitude !== undefined && s.longitude !== undefined) {
    p.set("lat", s.latitude.toFixed(4));
    p.set("lon", s.longitude.toFixed(4));
  }
  if (s.time !== undefined) p.set("t", String(Math.round(s.time)));
  if (s.zoom !== undefined && s.zoom !== 1) p.set("z", s.zoom.toFixed(2));
  if (s.target) p.set("o", s.target);
  return p.toString();
}

export function parseShareState(query: string): ShareState {
  const p = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const out: ShareState = {};

  const lat = finiteNum(p.get("lat"));
  const lon = finiteNum(p.get("lon"));
  if (lat !== undefined && lon !== undefined && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
    out.latitude = lat;
    out.longitude = lon;
  }

  const t = finiteNum(p.get("t"));
  if (t !== undefined && t > 0) out.time = t;

  const z = finiteNum(p.get("z"));
  if (z !== undefined && z > 0) out.zoom = z;

  const o = p.get("o");
  if (o) out.target = o;

  return out;
}
