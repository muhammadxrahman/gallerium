import { type RenderContext, type AltAzProjector } from "./canvas";
import { drawLabel } from "./labels";
import type { SunPosition } from "../astronomy/sun";

export interface RenderedSun extends SunPosition {
  az: number;
  alt: number;
}

export function renderSun(
  rc: RenderContext,
  sun: RenderedSun,
  project: AltAzProjector
): void {
  const pos = project(sun.alt, sun.az);
  if (!pos) return;
  const [x, y] = pos;

  const radius = 10; // largest, brightest object in the sky

  // Wide glow
  const glow = rc.ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
  glow.addColorStop(0, "rgba(255, 240, 180, 0.55)");
  glow.addColorStop(1, "transparent");
  rc.ctx.fillStyle = glow;
  rc.ctx.beginPath();
  rc.ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
  rc.ctx.fill();

  // Sun disc
  rc.ctx.fillStyle = "#fff6d5";
  rc.ctx.beginPath();
  rc.ctx.arc(x, y, radius, 0, Math.PI * 2);
  rc.ctx.fill();

  // Label
  drawLabel(rc.ctx, "Sun", x + radius + 4, y + 4, {
    font: "12px ui-sans-serif, system-ui, sans-serif",
    size: 12,
    fill: "rgba(255, 240, 180, 0.95)",
  });
}
