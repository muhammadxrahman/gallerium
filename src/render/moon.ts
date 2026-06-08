import { type RenderContext, altAzToXY, altAzToXYPointed } from "./canvas";
import type { MoonPosition } from "../astronomy/moon";

export interface RenderedMoon extends MoonPosition {
  az: number;
  alt: number;
}

export function renderMoon(
  rc: RenderContext,
  moon: RenderedMoon,
  pointed: boolean,
  centerAz?: number,
  centerAlt?: number,
  fov?: number
): void {
  let pos: [number, number] | null = null;

  if (pointed && centerAz !== undefined && centerAlt !== undefined && fov !== undefined) {
    pos = altAzToXYPointed(moon.alt, moon.az, centerAlt, centerAz, fov, rc);
  } else {
    if (moon.alt < 0) return;
    const [x, y] = altAzToXY(moon.alt, moon.az, rc);
    pos = [x, y];
  }

  if (!pos) return;
  const [x, y] = pos;

  const radius = 8;
  const illumination = moon.illumination;

  // Glow
  const glow = rc.ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
  glow.addColorStop(0, "rgba(255, 248, 220, 0.4)");
  glow.addColorStop(1, "transparent");
  rc.ctx.fillStyle = glow;
  rc.ctx.beginPath();
  rc.ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
  rc.ctx.fill();

  // Moon disc
  rc.ctx.fillStyle = "#fffdf0";
  rc.ctx.beginPath();
  rc.ctx.arc(x, y, radius, 0, Math.PI * 2);
  rc.ctx.fill();

  // Shadow to show phase. The terminator is symmetric about the vertical axis;
  // `waxing` decides which limb is lit (waxing = right lit in the N hemisphere).
  const litRight = moon.waxing;
  rc.ctx.fillStyle = "rgba(0, 0, 8, 0.85)";
  rc.ctx.beginPath();
  if (illumination < 0.5) {
    // Crescent: most of the disc is dark.
    rc.ctx.arc(x, y, radius, Math.PI / 2, -Math.PI / 2, litRight);
    const k = 1 - illumination * 2;
    rc.ctx.ellipse(x, y, radius * k, radius, 0, -Math.PI / 2, Math.PI / 2, litRight);
  } else {
    // Gibbous: most of the disc is lit.
    rc.ctx.arc(x, y, radius, Math.PI / 2, -Math.PI / 2, !litRight);
    const k = illumination * 2 - 1;
    rc.ctx.ellipse(x, y, radius * k, radius, 0, -Math.PI / 2, Math.PI / 2, !litRight);
  }
  rc.ctx.fill();

  // Label
  rc.ctx.fillStyle = "rgba(255, 248, 220, 0.85)";
  rc.ctx.font = "12px sans-serif";
  rc.ctx.fillText(`Moon ${Math.round(illumination * 100)}%`, x + radius + 4, y + 4);
}
