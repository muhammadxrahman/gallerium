import { type RenderContext, altAzToXY } from "./canvas";
import { drawLabel } from "./labels";
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

      drawLabel(rc.ctx, "ISS", x + 6, y + 4, {
        font: "bold 12px ui-sans-serif, system-ui, sans-serif",
        size: 12,
        fill: "rgba(0, 255, 136, 0.9)",
      });
    } else {
      // Other satellites: smaller, more subtle
      rc.ctx.fillStyle = "rgba(0, 200, 100, 0.6)";
      rc.ctx.beginPath();
      rc.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      rc.ctx.fill();
    }
  }
}