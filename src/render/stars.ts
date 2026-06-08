import { type RenderContext, altAzToXY, isVisible } from "./canvas";
import { drawLabel } from "./labels";
import type { Star } from "../data/stars";

export interface RenderedStar extends Star {
  az: number;
  alt: number;
}

// Map B-V color index to a CSS color
function starColor(ci: number): string {
  if (ci < -0.3) return "#9bb0ff"; // blue-white
  if (ci < 0.0)  return "#aabfff"; // blue
  if (ci < 0.3)  return "#cad7ff"; // blue-white
  if (ci < 0.6)  return "#ffffff"; // white
  if (ci < 1.0)  return "#fff4ea"; // yellow-white
  if (ci < 1.4)  return "#ffd2a1"; // orange
  return "#ffcc6f";                 // red-orange
}

// Brighter (lower magnitude) → larger dot.
function starRadius(magnitude: number): number {
  return Math.max(0.6, (6.5 - magnitude) * 0.42);
}

// Brighter stars are more opaque; faint ones sit lower so the field has depth.
function starAlpha(magnitude: number): number {
  return Math.max(0.35, Math.min(1, 1.15 - magnitude * 0.12));
}

// `visibility` (0..1) fades the whole field as daylight grows.
export function renderStars(
  rc: RenderContext,
  stars: RenderedStar[],
  visibility = 1
): void {
  if (visibility <= 0.01) return;

  for (const star of stars) {
    if (!isVisible(star.alt)) continue;

    const [x, y] = altAzToXY(star.alt, star.az, rc);
    const radius = starRadius(star.magnitude);
    const color = starColor(star.colorIndex);
    const alpha = starAlpha(star.magnitude) * visibility;

    // Soft glow for the brightest stars.
    if (star.magnitude < 1.5) {
      const glow = rc.ctx.createRadialGradient(x, y, 0, x, y, radius * 4.5);
      glow.addColorStop(0, color);
      glow.addColorStop(1, "transparent");
      rc.ctx.globalAlpha = 0.35 * visibility;
      rc.ctx.fillStyle = glow;
      rc.ctx.beginPath();
      rc.ctx.arc(x, y, radius * 4.5, 0, Math.PI * 2);
      rc.ctx.fill();
    }

    rc.ctx.globalAlpha = alpha;
    rc.ctx.fillStyle = color;
    rc.ctx.beginPath();
    rc.ctx.arc(x, y, radius, 0, Math.PI * 2);
    rc.ctx.fill();
  }

  rc.ctx.globalAlpha = 1;

  // Labels for the brightest named stars (decluttered against everything else).
  for (const star of stars) {
    if (!isVisible(star.alt) || !star.name || star.magnitude >= 2.0) continue;
    const [x, y] = altAzToXY(star.alt, star.az, rc);
    const radius = starRadius(star.magnitude);
    drawLabel(rc.ctx, star.name, x + radius + 4, y + 3, {
      font: "11px ui-sans-serif, system-ui, sans-serif",
      size: 11,
      fill: `rgba(220,228,255,${(0.8 * visibility).toFixed(3)})`,
    });
  }
}
