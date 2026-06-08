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

// Four soft diffraction spikes for the very brightest stars — a premium, static touch.
function drawSpikes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  color: string,
  alpha: number
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = color;
  for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    const grad = ctx.createLinearGradient(x - dx * len, y - dy * len, x + dx * len, y + dy * len);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, "transparent");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - dx * len, y - dy * len);
    ctx.lineTo(x + dx * len, y + dy * len);
    ctx.stroke();
  }
  ctx.restore();
}

// `visibility` (0..1) fades the whole field as daylight grows. `magLimit` hides
// stars fainter than the chosen limiting magnitude (light-pollution control).
export function renderStars(
  rc: RenderContext,
  stars: RenderedStar[],
  visibility = 1,
  magLimit = 6.5
): void {
  if (visibility <= 0.01) return;

  for (const star of stars) {
    if (star.magnitude > magLimit) continue;
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
    rc.ctx.globalAlpha = 1;

    // Diffraction spikes on the showpiece stars.
    if (star.magnitude < 1.0) {
      drawSpikes(rc.ctx, x, y, radius * 6, color, 0.5 * visibility);
    }
  }

  rc.ctx.globalAlpha = 1;

  // Labels for the brightest named stars (decluttered against everything else).
  for (const star of stars) {
    if (star.magnitude > magLimit) continue;
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
