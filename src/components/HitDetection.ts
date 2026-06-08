import type { AltAzProjector } from "../render/canvas";
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

// Pure hit-test: given a canvas-local point, a projector, and the rendered objects,
// return the selected object (or null). Priority is largest/brightest first: Sun,
// Moon, planets, satellites, then stars (brightest first). `project` MUST be the
// same projector the active view drew with (map dome or AR), so this works in both
// views and stays aligned with zoom/pan/orientation.
export function pickObject(
  x: number,
  y: number,
  project: AltAzProjector,
  stars: RenderedStar[],
  planets: RenderedPlanet[],
  satellites: RenderedSatellite[],
  moon: RenderedMoon | null,
  sun: RenderedSun | null
): SelectedObject {
  // Sun first — largest target.
  if (sun) {
    const p = project(sun.alt, sun.az);
    if (p && dist(x, y, p[0], p[1]) < SUN_HIT_RADIUS) return { type: "sun", data: sun };
  }

  // Then the Moon — also large and bright.
  if (moon) {
    const p = project(moon.alt, moon.az);
    if (p && dist(x, y, p[0], p[1]) < MOON_HIT_RADIUS) return { type: "moon", data: moon };
  }

  // Planets (biggest point targets).
  for (const planet of planets) {
    const p = project(planet.alt, planet.az);
    if (p && dist(x, y, p[0], p[1]) < HIT_RADIUS) return { type: "planet", data: planet };
  }

  // Satellites (only those reasonably above the horizon, matching the renderer).
  for (const sat of satellites) {
    if (sat.alt < 10) continue;
    const p = project(sat.alt, sat.az);
    if (p && dist(x, y, p[0], p[1]) < HIT_RADIUS) return { type: "satellite", data: sat };
  }

  // Stars — prefer the brighter (lower-magnitude) one when several overlap.
  const sorted = [...stars].sort((a, b) => a.magnitude - b.magnitude);
  for (const star of sorted) {
    const p = project(star.alt, star.az);
    if (p && dist(x, y, p[0], p[1]) < HIT_RADIUS) return { type: "star", data: star };
  }

  return null; // empty space
}

export function handleClick(
  e: MouseEvent | TouchEvent,
  canvas: HTMLCanvasElement,
  project: AltAzProjector,
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

  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  state.selected = pickObject(x, y, project, stars, planets, satellites, moon, sun);
}