import { type RenderContext, altAzToXY, isVisible } from "./canvas";
import type { Planet } from "../astronomy/planets";

const PLANET_COLORS: Record<string, string> = {
  Mercury: "#b5b5b5",
  Venus:   "#fffacd",
  Mars:    "#ff6b35",
  Jupiter: "#c88b3a",
  Saturn:  "#e4d191",
};

const PLANET_RADIUS = 4;

export interface RenderedPlanet extends Planet {
  az: number;
  alt: number;
}

export function renderPlanets(
  rc: RenderContext,
  planets: RenderedPlanet[]
): void {
  for (const planet of planets) {
    if (!isVisible(planet.alt)) continue;

    const [x, y] = altAzToXY(planet.alt, planet.az, rc);
    const color = PLANET_COLORS[planet.name] ?? "#ffffff";

    // Glow
    const glow = rc.ctx.createRadialGradient(x, y, 0, x, y, PLANET_RADIUS * 3);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "transparent");
    rc.ctx.fillStyle = glow;
    rc.ctx.beginPath();
    rc.ctx.arc(x, y, PLANET_RADIUS * 3, 0, Math.PI * 2);
    rc.ctx.fill();

    // Planet dot
    rc.ctx.fillStyle = color;
    rc.ctx.beginPath();
    rc.ctx.arc(x, y, PLANET_RADIUS, 0, Math.PI * 2);
    rc.ctx.fill();

    // Label
    rc.ctx.fillStyle = "rgba(255,255,255,0.85)";
    rc.ctx.font = "12px sans-serif";
    rc.ctx.fillText(planet.name, x + PLANET_RADIUS + 4, y + 4);
  }
}