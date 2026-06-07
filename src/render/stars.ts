import { type RenderContext, altAzToXY, isVisible } from "./canvas";
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

// Map magnitude to pixel radius: brighter = bigger
function starRadius(magnitude: number): number {
  return Math.max(0.5, 3.5 - magnitude * 0.5);
}

export function renderStars(
  rc: RenderContext,
  stars: RenderedStar[]
): void {
  for (const star of stars) {
    if (!isVisible(star.alt)) continue;

    const [x, y] = altAzToXY(star.alt, star.az, rc);
    const radius = starRadius(star.magnitude);
    const color = starColor(star.colorIndex);

    // Glow effect for bright stars
    if (star.magnitude < 2) {
      const glow = rc.ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
      glow.addColorStop(0, color);
      glow.addColorStop(1, "transparent");
      rc.ctx.fillStyle = glow;
      rc.ctx.beginPath();
      rc.ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
      rc.ctx.fill();
    }

    // Star dot
    rc.ctx.fillStyle = color;
    rc.ctx.beginPath();
    rc.ctx.arc(x, y, radius, 0, Math.PI * 2);
    rc.ctx.fill();

    // Label for named stars
    if (star.name && star.magnitude < 2.5) {
      rc.ctx.fillStyle = "rgba(255,255,255,0.7)";
      rc.ctx.font = "11px sans-serif";
      rc.ctx.fillText(star.name, x + radius + 3, y + 3);
    }
  }
}