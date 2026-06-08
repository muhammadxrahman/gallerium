import { type RenderContext, type AltAzProjector } from "./canvas";
import { drawLabel } from "./labels";
import type { DeepSkyObject, DeepSkyKind } from "../data/deepSky";

export interface RenderedDeepSky extends DeepSkyObject {
  az: number;
  alt: number;
}

// Each kind gets a recognizable, restrained glyph so deep-sky objects read as a
// distinct class from stars (which are crisp dots) without overpowering them.
const KIND_COLOR: Record<DeepSkyKind, string> = {
  galaxy: "#cdbff0", // pale violet
  "open-cluster": "#bcd3ff", // pale blue
  "globular-cluster": "#ffe6b0", // warm gold
  nebula: "#ff9fb0", // soft rose (emission)
  "planetary-nebula": "#8ff0e0", // teal
  "supernova-remnant": "#ff8c7a", // ember
};

// Brighter (lower-magnitude) objects draw a touch larger. Deep-sky objects are dim,
// so the range is modest.
function glyphSize(magnitude: number): number {
  return Math.max(3, Math.min(7, 7 - magnitude * 0.4));
}

function softBlob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: DeepSkyKind,
  r: number,
  alpha: number
): void {
  const color = KIND_COLOR[kind];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;

  switch (kind) {
    case "galaxy": {
      // Tilted ellipse outline.
      ctx.translate(x, y);
      ctx.rotate(-0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.5, r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "globular-cluster": {
      // Fuzzy filled core.
      ctx.restore();
      softBlob(ctx, x, y, r * 1.4, color, alpha * 0.9);
      return;
    }
    case "open-cluster": {
      // Dashed circle (loose grouping of stars).
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "nebula":
    case "supernova-remnant": {
      // Soft diffuse cloud.
      ctx.restore();
      softBlob(ctx, x, y, r * 1.6, color, alpha * 0.7);
      return;
    }
    case "planetary-nebula": {
      // Small ring with a center dot.
      ctx.beginPath();
      ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 0.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// Draws the deep-sky layer. `visibility` (0..1) fades it as daylight grows, matching
// the star field. `project` maps alt/az to pixels (or null when culled), so the same
// renderer serves both the map dome and the AR view.
export function renderDeepSky(
  rc: RenderContext,
  objects: RenderedDeepSky[],
  project: AltAzProjector,
  visibility = 1
): void {
  if (visibility <= 0.01) return;

  const alpha = Math.max(0.25, Math.min(0.85, visibility * 0.8));

  for (const o of objects) {
    const p = project(o.alt, o.az);
    if (!p) continue;
    const [x, y] = p;
    drawGlyph(rc.ctx, x, y, o.kind, glyphSize(o.magnitude), alpha);
  }
  rc.ctx.globalAlpha = 1;

  // Labels for the brighter objects, decluttered against everything already placed.
  for (const o of objects) {
    if (o.magnitude > 7) continue; // keep only the prominent ones labeled
    const p = project(o.alt, o.az);
    if (!p) continue;
    const [x, y] = p;
    const r = glyphSize(o.magnitude);
    drawLabel(rc.ctx, o.id, x + r + 4, y + 3, {
      font: "10px ui-sans-serif, system-ui, sans-serif",
      size: 10,
      fill: `rgba(210,210,235,${(0.7 * visibility).toFixed(3)})`,
    });
  }
}
