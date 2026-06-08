import { type RenderContext, altAzToXY, altAzToXYPointed } from "./canvas";
import { drawLabel } from "./labels";
import type { SunPosition } from "../astronomy/sun";

export interface RenderedSun extends SunPosition {
  az: number;
  alt: number;
}

export function renderSun(
  rc: RenderContext,
  sun: RenderedSun,
  pointed: boolean,
  centerAz?: number,
  centerAlt?: number,
  fov?: number
): void {
  let pos: [number, number] | null = null;

  if (pointed && centerAz !== undefined && centerAlt !== undefined && fov !== undefined) {
    pos = altAzToXYPointed(sun.alt, sun.az, centerAlt, centerAz, fov, rc);
  } else {
    if (sun.alt < 0) return; // below the horizon
    pos = altAzToXY(sun.alt, sun.az, rc);
  }

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
