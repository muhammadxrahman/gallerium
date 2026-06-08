import type { EqProjector } from "./canvas";
import type { MilkyWaySample } from "../astronomy/referenceLines";

// Soft, diffuse glow along the galactic plane. Each weighted sample is a low-alpha
// radial blob; drawn additively ("lighter") they accumulate into a believable band,
// brighter toward the galactic center. `alpha` is the global night/visibility factor.
export function renderMilkyWay(
  ctx: CanvasRenderingContext2D,
  project: EqProjector,
  samples: MilkyWaySample[],
  alpha: number
): void {
  if (alpha <= 0.02) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const radius = 34;

  for (const s of samples) {
    const p = project(s.ra, s.dec);
    if (!p) continue;
    const a = 0.05 * s.w * alpha;
    if (a < 0.004) continue;
    const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], radius);
    g.addColorStop(0, `rgba(200,210,245,${a.toFixed(3)})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p[0], p[1], radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
