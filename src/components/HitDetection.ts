import { type RenderContext, altAzToXY } from "../render/canvas";
import type { RenderedStar } from "../render/stars";
import type { RenderedPlanet } from "../render/planets";
import type { RenderedSatellite } from "../render/satellites";
import type { RenderedMoon } from "../render/moon";
import type { RenderedSun } from "../render/sun";
import { state, type SelectedObject } from "../store/state";

const HIT_RADIUS = 12; // pixels
const MOON_HIT_RADIUS = 16; // the Moon disc + glow is larger than a point object
const SUN_HIT_RADIUS = 18; // the Sun is the largest target

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// Pure hit-test: given a canvas-local point and the rendered objects, return the
// selected object (or null). Priority is largest/brightest first: Sun, Moon,
// planets, satellites, then stars (brightest first). The rc MUST already have the
// same zoom/pan applied as the render pass so projected positions match what's drawn.
export function pickObject(
  x: number,
  y: number,
  rc: RenderContext,
  stars: RenderedStar[],
  planets: RenderedPlanet[],
  satellites: RenderedSatellite[],
  moon: RenderedMoon | null,
  sun: RenderedSun | null
): SelectedObject {
  // Sun first — largest target.
  if (sun && sun.alt >= 0) {
    const [sx, sy] = altAzToXY(sun.alt, sun.az, rc);
    if (dist(x, y, sx, sy) < SUN_HIT_RADIUS) return { type: "sun", data: sun };
  }

  // Then the Moon — also large and bright.
  if (moon && moon.alt >= 0) {
    const [mx, my] = altAzToXY(moon.alt, moon.az, rc);
    if (dist(x, y, mx, my) < MOON_HIT_RADIUS) return { type: "moon", data: moon };
  }

  // Planets (biggest point targets).
  for (const planet of planets) {
    if (planet.alt < 0) continue;
    const [px, py] = altAzToXY(planet.alt, planet.az, rc);
    if (dist(x, y, px, py) < HIT_RADIUS) return { type: "planet", data: planet };
  }

  // Satellites (only those reasonably above the horizon, matching the renderer).
  for (const sat of satellites) {
    if (sat.alt < 10) continue;
    const [sx, sy] = altAzToXY(sat.alt, sat.az, rc);
    if (dist(x, y, sx, sy) < HIT_RADIUS) return { type: "satellite", data: sat };
  }

  // Stars — prefer the brighter (lower-magnitude) one when several overlap.
  const sorted = [...stars].sort((a, b) => a.magnitude - b.magnitude);
  for (const star of sorted) {
    if (star.alt < 0) continue;
    const [sx, sy] = altAzToXY(star.alt, star.az, rc);
    if (dist(x, y, sx, sy) < HIT_RADIUS) return { type: "star", data: star };
  }

  return null; // empty space
}

export function handleClick(
  e: MouseEvent | TouchEvent,
  rc: RenderContext,
  stars: RenderedStar[],
  planets: RenderedPlanet[],
  satellites: RenderedSatellite[],
  moon: RenderedMoon | null,
  sun: RenderedSun | null
): void {
  let clientX: number, clientY: number;

  if (e instanceof TouchEvent) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  const rect = rc.canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  state.selected = pickObject(x, y, rc, stars, planets, satellites, moon, sun);
}