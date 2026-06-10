import { type RenderContext, type AltAzProjector } from "./canvas";
import { drawLabel } from "./labels";
import { earthshineLevel } from "./animate";
import type { MoonPosition } from "../astronomy/moon";

export interface RenderedMoon extends MoonPosition {
  az: number;
  alt: number;
}

export function renderMoon(
  rc: RenderContext,
  moon: RenderedMoon,
  project: AltAzProjector
): void {
  const pos = project(moon.alt, moon.az);
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
  // Earthshine: the unlit disc isn't pure black — it glows faintly ashen, brightest on a
  // thin crescent and fading to near-black as the Moon waxes (covers the lit fill below).
  const litRight = moon.waxing;
  const es = earthshineLevel(illumination);
  const er = Math.round(8 + 58 * es);
  const eg = Math.round(11 + 66 * es);
  const eb = Math.round(20 + 82 * es);
  rc.ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, 0.9)`;
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
  drawLabel(rc.ctx, `Moon ${Math.round(illumination * 100)}%`, x + radius + 4, y + 4, {
    font: "12px ui-sans-serif, system-ui, sans-serif",
    size: 12,
    fill: "rgba(255, 248, 220, 0.9)",
  });
}
