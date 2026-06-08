// Search index + "guide me there" target resolution — pure, so it can be tested
// without DOM. The UI (Search overlay, guide arrow, map centering) lives in main.

import { equatorialToHorizontal, type Observer } from "../astronomy/coordinates";
import { cleanProperName, type Star } from "../data/stars";
import { DEEP_SKY_KIND_LABEL, type DeepSkyObject } from "../data/deepSky";
import type { SearchItem } from "../components/Search";
import type { SelectedObject } from "../store/state";
import type { SkyBodies } from "./compute";

export type TargetMeta =
  | { kind: "sun" }
  | { kind: "moon" }
  | { kind: "planet"; name: string }
  | { kind: "star"; id: number; label: string }
  | { kind: "deepsky"; id: string; label: string }
  | { kind: "con"; label: string; ra: number; dec: number };

// The naked-eye planets plus the two outer (telescopic) planets, in distance order.
export const PLANET_NAMES = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];

export interface SearchIndex {
  items: SearchItem[];
  meta: Map<string, TargetMeta>;
}

export function buildSearchIndex(
  precessedStars: Star[],
  constellations: Array<{ n: string; ra: number; dec: number }>,
  deepSky: DeepSkyObject[] = []
): SearchIndex {
  const items: SearchItem[] = [];
  const meta = new Map<string, TargetMeta>();
  const add = (id: string, label: string, sublabel: string, m: TargetMeta) => {
    items.push({ id, label, sublabel });
    meta.set(id, m);
  };

  add("sun", "Sun", "Star", { kind: "sun" });
  add("moon", "Moon", "Moon", { kind: "moon" });
  for (const n of PLANET_NAMES) add(`planet:${n}`, n, "Planet", { kind: "planet", name: n });
  for (const s of precessedStars) {
    const label = cleanProperName(s.name);
    if (label) add(`star:${s.id}`, label, "Star", { kind: "star", id: s.id, label });
  }
  for (const o of deepSky) {
    // Searchable by both the common name and the catalog id (e.g. "Andromeda" or "M31").
    const label = o.name === o.id ? o.id : `${o.name} (${o.id})`;
    add(`deepsky:${o.id}`, label, DEEP_SKY_KIND_LABEL[o.kind], { kind: "deepsky", id: o.id, label });
  }
  for (const c of constellations) {
    add(`con:${c.n}`, c.n, "Constellation", { kind: "con", label: c.n, ra: c.ra, dec: c.dec });
  }

  return { items, meta };
}

export function targetLabel(meta: TargetMeta): string {
  if (meta.kind === "sun") return "Sun";
  if (meta.kind === "moon") return "Moon";
  if (meta.kind === "planet") return meta.name;
  return meta.label;
}

// Current alt/az of a target from the latest computed sky (null if not present /
// below the horizon handling is left to callers).
export function targetAltAz(
  meta: TargetMeta,
  sky: SkyBodies,
  observer: Observer
): { alt: number; az: number } | null {
  switch (meta.kind) {
    case "sun":
      return sky.sun ? { alt: sky.sun.alt, az: sky.sun.az } : null;
    case "moon":
      return sky.moon ? { alt: sky.moon.alt, az: sky.moon.az } : null;
    case "planet": {
      const p = sky.planets.find((x) => x.name === meta.name);
      return p ? { alt: p.alt, az: p.az } : null;
    }
    case "star": {
      const s = sky.stars.find((x) => x.id === meta.id);
      return s ? { alt: s.alt, az: s.az } : null;
    }
    case "deepsky": {
      const d = sky.deepSky.find((x) => x.id === meta.id);
      return d ? { alt: d.alt, az: d.az } : null;
    }
    case "con":
      return equatorialToHorizontal({ ra: meta.ra, dec: meta.dec }, observer, sky.lst);
  }
}

// The selection (info card + ring) for a target. Constellations have no info card,
// so they resolve to null.
export function targetSelection(meta: TargetMeta, sky: SkyBodies): SelectedObject {
  if (meta.kind === "sun") return sky.sun ? { type: "sun", data: sky.sun } : null;
  if (meta.kind === "moon") return sky.moon ? { type: "moon", data: sky.moon } : null;
  if (meta.kind === "planet") {
    const p = sky.planets.find((x) => x.name === meta.name);
    return p ? { type: "planet", data: p } : null;
  }
  if (meta.kind === "star") {
    const s = sky.stars.find((x) => x.id === meta.id);
    return s ? { type: "star", data: s } : null;
  }
  if (meta.kind === "deepsky") {
    const d = sky.deepSky.find((x) => x.id === meta.id);
    return d ? { type: "deepsky", data: d } : null;
  }
  return null;
}
