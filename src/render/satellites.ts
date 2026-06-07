import { type RenderContext, altAzToXY } from "./canvas";
import type { SatellitePosition } from "../astronomy/satellites";

export interface RenderedSatellite extends SatellitePosition {
  az: number;
  alt: number;
}

export function renderSatellites(
  rc: RenderContext,
  satellites: RenderedSatellite[]
): void {
  for (const sat of satellites) {
    // Only show satellites reasonably above the horizon
    if (sat.alt < 10) continue;

    const [x, y] = altAzToXY(sat.alt, sat.az, rc);
    const isISS = sat.name.includes("ISS");

    if (isISS) {
      // ISS gets a distinct look
      rc.ctx.fillStyle = "rgba(0, 255, 136, 0.95)";
      rc.ctx.beginPath();
      rc.ctx.arc(x, y, 4, 0, Math.PI * 2);
      rc.ctx.fill();

      rc.ctx.fillStyle = "rgba(0, 255, 136, 0.85)";
      rc.ctx.font = "bold 12px sans-serif";
      rc.ctx.fillText("ISS", x + 6, y + 4);
    } else {
      // Other satellites: smaller, more subtle
      rc.ctx.fillStyle = "rgba(0, 200, 100, 0.6)";
      rc.ctx.beginPath();
      rc.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      rc.ctx.fill();
    }
  }
}