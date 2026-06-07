import { type RenderContext, altAzToXY } from "../render/canvas";
import type { RenderedStar } from "../render/stars";
import type { RenderedPlanet } from "../render/planets";
import type { RenderedSatellite } from "../render/satellites";
import { state } from "../store/state";

const HIT_RADIUS = 12; // pixels

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

export function handleClick(
  e: MouseEvent | TouchEvent,
  rc: RenderContext,
  stars: RenderedStar[],
  planets: RenderedPlanet[],
  satellites: RenderedSatellite[]
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

  // Check planets first (biggest targets)
  for (const planet of planets) {
    if (planet.alt < 0) continue;
    const [px, py] = altAzToXY(planet.alt, planet.az, rc);
    if (dist(x, y, px, py) < HIT_RADIUS) {
      state.selected = { type: "planet", data: planet };
      return;
    }
  }

  // Check satellites
  for (const sat of satellites) {
    if (sat.alt < 10) continue;
    const [sx, sy] = altAzToXY(sat.alt, sat.az, rc);
    if (dist(x, y, sx, sy) < HIT_RADIUS) {
      state.selected = { type: "satellite", data: sat };
      return;
    }
  }

  // Check stars — prioritize brighter ones
  const sorted = [...stars].sort((a, b) => a.magnitude - b.magnitude);
  for (const star of sorted) {
    if (star.alt < 0) continue;
    const [sx, sy] = altAzToXY(star.alt, star.az, rc);
    if (dist(x, y, sx, sy) < HIT_RADIUS) {
      state.selected = { type: "star", data: star };
      return;
    }
  }

  // Clicked empty space — deselect
  state.selected = null;
}