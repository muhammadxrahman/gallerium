import { type RenderContext, type AltAzProjector } from "./canvas";
import { drawLabel } from "./labels";
import { twinkle, clamp01 } from "./animate";
import type { Star } from "../data/stars";

export interface RenderedStar extends Star {
  az: number;
  alt: number;
}

const TWINKLE_MAG = 2.5; // only the brighter stars scintillate (tasteful + cheap)

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
// `project` maps alt/az to screen pixels (or null when it shouldn't be drawn), so
// the same renderer serves both the map dome and the AR view.
// `timeMs` drives subtle scintillation on the brightest stars (0 = no twinkle).
// `reveal` (0..1) ramps the field in during the first-load reveal, brightest first;
// it also heightens twinkle while < 1 so the sky sparkles to life.
export function renderStars(
  rc: RenderContext,
  stars: RenderedStar[],
  project: AltAzProjector,
  visibility = 1,
  magLimit = 6.5,
  timeMs = 0,
  reveal = 1
): void {
  if (visibility <= 0.01) return;
  const twinkleAmp = 0.16 + (1 - reveal) * 0.35; // sparklier during the reveal, calm after

  for (const star of stars) {
    if (star.magnitude > magLimit) continue;
    const p = project(star.alt, star.az);
    if (!p) continue;

    // Reveal stagger: brighter (lower-magnitude) stars reach full alpha first.
    const rv = reveal >= 1 ? 1 : clamp01(reveal * 1.4 - (star.magnitude / magLimit) * 0.4);
    if (rv <= 0.01) continue;

    // Scintillation on the brighter stars only (cheap: a few dozen sines).
    const tw =
      timeMs > 0 && star.magnitude < TWINKLE_MAG ? 1 + twinkleAmp * twinkle(timeMs, star.id) : 1;

    const [x, y] = p;
    const radius = starRadius(star.magnitude);
    const color = starColor(star.colorIndex);
    const alpha = starAlpha(star.magnitude) * visibility * rv * tw;

    // Soft glow for the brightest stars.
    if (star.magnitude < 1.5) {
      const glow = rc.ctx.createRadialGradient(x, y, 0, x, y, radius * 4.5);
      glow.addColorStop(0, color);
      glow.addColorStop(1, "transparent");
      rc.ctx.globalAlpha = 0.35 * visibility * rv * tw;
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
      drawSpikes(rc.ctx, x, y, radius * 6, color, 0.5 * visibility * rv);
    }
  }

  rc.ctx.globalAlpha = 1;

  // Labels for the brightest named stars (decluttered against everything else).
  for (const star of stars) {
    if (star.magnitude > magLimit || !star.name || star.magnitude >= 2.0) continue;
    const p = project(star.alt, star.az);
    if (!p) continue;
    const [x, y] = p;
    const radius = starRadius(star.magnitude);
    drawLabel(rc.ctx, star.name, x + radius + 4, y + 3, {
      font: "11px ui-sans-serif, system-ui, sans-serif",
      size: 11,
      fill: `rgba(220,228,255,${(0.8 * visibility).toFixed(3)})`,
    });
  }
}
