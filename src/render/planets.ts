import { type RenderContext, type AltAzProjector } from "./canvas";
import { drawLabel } from "./labels";
import type { Planet } from "../astronomy/planets";

interface PlanetStyle {
  color: string;
  highlight: string;
  radius: number;
  ring?: boolean;
  bands?: boolean;
}

// Apparent magnitudes aren't modeled yet, so prominence is hand-tuned to match how
// these planets actually look to the eye (Venus/Jupiter dominant, Mercury faint).
const PLANET_STYLE: Record<string, PlanetStyle> = {
  Mercury: { color: "#b8b2a6", highlight: "#e8e2d6", radius: 3 },
  Venus:   { color: "#f6e7b6", highlight: "#fffdf0", radius: 6 },
  Mars:    { color: "#e0623a", highlight: "#ff9a6b", radius: 4 },
  Jupiter: { color: "#d3b68c", highlight: "#f3e2c2", radius: 6.5, bands: true },
  Saturn:  { color: "#e3cf9b", highlight: "#fff2cc", radius: 5, ring: true },
};

export interface RenderedPlanet extends Planet {
  az: number;
  alt: number;
}

function ringPath(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 2.3, r * 0.74, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 0, r * 1.42, r * 0.46, 0, 0, Math.PI * 2);
}

// Draws a planet glyph centered at (x, y): glow, a shaded sphere, and characteristic
// features (Saturn's rings, Jupiter's bands). Shared by the map and AR views.
export function drawPlanetBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  scale = 1
): number {
  const st = PLANET_STYLE[name] ?? { color: "#ffffff", highlight: "#ffffff", radius: 4 };
  const r = st.radius * scale;

  // Soft glow
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
  glow.addColorStop(0, st.color);
  glow.addColorStop(1, "transparent");
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const RING_TILT = -0.42; // radians

  // Back half of the ring (behind the planet).
  if (st.ring) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(RING_TILT);
    ctx.beginPath();
    ctx.rect(-r * 2.4, -r * 1.0, r * 4.8, r * 1.0); // upper (far) half
    ctx.clip();
    ringPath(ctx, r);
    ctx.fillStyle = "rgba(225,205,150,0.75)";
    ctx.fill("evenodd");
    ctx.restore();
  }

  // Sphere with an offset highlight for a lit look.
  const body = ctx.createRadialGradient(
    x - r * 0.35,
    y - r * 0.35,
    r * 0.1,
    x,
    y,
    r
  );
  body.addColorStop(0, st.highlight);
  body.addColorStop(1, st.color);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Jupiter's belts.
  if (st.bands) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    const belts = [-0.45, -0.1, 0.25, 0.55];
    for (const b of belts) {
      ctx.fillStyle = `rgba(150,110,70,${b === 0.25 ? 0.28 : 0.18})`;
      ctx.fillRect(x - r, y + b * r - r * 0.09, r * 2, r * 0.18);
    }
    ctx.restore();
  }

  // Front half of the ring (crosses in front of the planet).
  if (st.ring) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(RING_TILT);
    ctx.beginPath();
    ctx.rect(-r * 2.4, 0, r * 4.8, r * 1.0); // lower (near) half
    ctx.clip();
    ringPath(ctx, r);
    ctx.fillStyle = "rgba(235,215,160,0.92)";
    ctx.fill("evenodd");
    ctx.restore();
  }

  return st.ring ? r * 2.3 : r;
}

// Brighter (lower-magnitude) planets render a bit larger, like the eye sees them.
function magnitudeScale(mag: number): number {
  return Math.max(0.75, Math.min(1.7, 1.3 - mag * 0.16));
}

export function renderPlanets(
  rc: RenderContext,
  planets: RenderedPlanet[],
  project: AltAzProjector
): void {
  for (const planet of planets) {
    const p = project(planet.alt, planet.az);
    if (!p) continue;
    const [x, y] = p;
    const reach = drawPlanetBody(rc.ctx, x, y, planet.name, magnitudeScale(planet.magnitude));
    drawLabel(rc.ctx, planet.name, x + reach + 5, y + 4, {
      font: "12px ui-sans-serif, system-ui, sans-serif",
      size: 12,
      fill: "rgba(255,255,255,0.9)",
    });
  }
}
