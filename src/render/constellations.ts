import type { EqProjector } from "./canvas";
import { drawLabel } from "./labels";
import rawData from "../data/constellations.json";

interface ConstellationData {
  lines: Array<Array<[number, number]>>; // polylines of [ra, dec] (degrees)
  names: Array<{ n: string; ra: number; dec: number }>;
}

const data = rawData as ConstellationData;

// Constellation names with a representative RA/Dec — for the search index.
export function constellationNames(): Array<{ n: string; ra: number; dec: number }> {
  return data.names;
}

// Faint joining lines between stars. Segments are only drawn when both endpoints
// project (so lines break cleanly at the horizon / field-of-view edge).
export function renderConstellationLines(
  ctx: CanvasRenderingContext2D,
  project: EqProjector,
  alpha: number
): void {
  if (alpha <= 0.01) return;
  ctx.strokeStyle = `rgba(120,150,205,${(0.45 * alpha).toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const poly of data.lines) {
    let prev: [number, number] | null = null;
    for (const [ra, dec] of poly) {
      const p = project(ra, dec);
      if (p && prev) {
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(p[0], p[1]);
      }
      prev = p;
    }
  }
  ctx.stroke();
}

export function renderConstellationNames(
  ctx: CanvasRenderingContext2D,
  project: EqProjector,
  alpha: number
): void {
  if (alpha <= 0.01) return;
  const fill = `rgba(150,170,215,${(0.55 * alpha).toFixed(3)})`;
  for (const { n, ra, dec } of data.names) {
    const p = project(ra, dec);
    if (!p) continue;
    drawLabel(ctx, n.toUpperCase(), p[0], p[1], {
      font: "10px ui-sans-serif, system-ui, sans-serif",
      size: 10,
      fill,
      padding: 6,
    });
  }
}
