// "Tonight" feed composition — pure (no DOM), so it can be unit-tested. Combines the
// computed sky with rise/set, pass prediction, and conjunction geometry.

import {
  riseTransitSet,
  STD_ALT_SUN,
  STD_ALT_STAR,
  TWILIGHT_ASTRONOMICAL,
} from "../astronomy/riseset";
import { predictPasses } from "../astronomy/passes";
import { moonPhaseName } from "../astronomy/moon";
import type { TLE } from "../astronomy/satellites";
import type { Observer } from "../astronomy/coordinates";
import { icon } from "../components/icons";
import type { HighlightItem } from "../components/Highlights";
import type { SkyBodies } from "./compute";

const COMPASS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

export function dirName(az: number): string {
  return COMPASS_16[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
}

export function clockStr(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function angularSeparation(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const r = Math.PI / 180;
  const c =
    Math.sin(dec1 * r) * Math.sin(dec2 * r) +
    Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.cos((ra1 - ra2) * r);
  return Math.acos(Math.max(-1, Math.min(1, c))) * (180 / Math.PI);
}

export function computeHighlights(
  sky: SkyBodies,
  observer: Observer,
  now: Date,
  tles: TLE[]
): HighlightItem[] {
  const items: HighlightItem[] = [];

  if (sky.sun) {
    const sset = riseTransitSet(sky.sun.ra, sky.sun.dec, observer, now, STD_ALT_SUN);
    const dark = riseTransitSet(sky.sun.ra, sky.sun.dec, observer, now, TWILIGHT_ASTRONOMICAL);
    const parts: string[] = [];
    if (sset.set) parts.push(`Sunset ${clockStr(sset.set)}`);
    if (dark.set) parts.push(`astro-dark ${clockStr(dark.set)}`);
    if (parts.length) items.push({ icon: icon("sun"), text: parts.join(" · ") });
  }

  if (sky.moon) {
    const rts = riseTransitSet(sky.moon.ra, sky.moon.dec, observer, now, STD_ALT_STAR);
    let when = "";
    if (sky.moon.alt >= 0 && rts.set) when = `, sets ${clockStr(rts.set)}`;
    else if (sky.moon.alt < 0 && rts.rise) when = `, rises ${clockStr(rts.rise)}`;
    const phase = moonPhaseName(sky.moon.illumination, sky.moon.waxing);
    items.push({ icon: icon("moon"), text: `${phase} (${Math.round(sky.moon.illumination * 100)}%)${when}` });
  }

  for (const p of sky.planets) {
    const rts = riseTransitSet(p.ra, p.dec, observer, now, STD_ALT_STAR);
    const mag = `mag ${p.magnitude.toFixed(1)}`;
    if (p.alt >= 0) {
      items.push({ icon: icon("planet"), text: `${p.name} up now (${mag})${rts.set ? `, sets ${clockStr(rts.set)}` : ""}` });
    } else if (rts.rise) {
      items.push({ icon: icon("planet"), text: `${p.name} rises ${clockStr(rts.rise)} (${mag})` });
    }
  }

  // Close pairings (Moon + planets within 5°).
  const bodies = [
    ...(sky.moon ? [{ name: "Moon", ra: sky.moon.ra, dec: sky.moon.dec }] : []),
    ...sky.planets.map((p) => ({ name: p.name, ra: p.ra, dec: p.dec })),
  ];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const sep = angularSeparation(bodies[i].ra, bodies[i].dec, bodies[j].ra, bodies[j].dec);
      if (sep < 5) {
        items.push({ icon: icon("conjunction"), text: `${bodies[i].name} & ${bodies[j].name} ${sep.toFixed(1)}° apart` });
      }
    }
  }

  // Next visible ISS pass in the coming 24h.
  const iss = tles.find((t) => t.name.includes("ISS"));
  if (iss) {
    const passes = predictPasses(iss, observer, now, { hours: 24 });
    if (passes.length) {
      const p = passes[0];
      items.push({
        icon: icon("satellite"),
        text: `ISS ${clockStr(p.start)} — peak ${p.peakElevation.toFixed(0)}°, ${dirName(p.startAz)}→${dirName(p.endAz)}`,
      });
    }
  }

  return items;
}
