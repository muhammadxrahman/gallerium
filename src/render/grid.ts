import type { EqProjector, AltAzProjector } from "./canvas";

// Draw an RA/Dec polyline, breaking the stroke wherever a vertex doesn't project.
function strokePath(
  ctx: CanvasRenderingContext2D,
  project: EqProjector,
  points: Array<[number, number]>
): void {
  let prev: [number, number] | null = null;
  for (const [ra, dec] of points) {
    const p = project(ra, dec);
    if (p && prev) {
      ctx.moveTo(prev[0], prev[1]);
      ctx.lineTo(p[0], p[1]);
    }
    prev = p;
  }
}

// Equatorial grid: RA meridians every 30° (2h) and Dec parallels every 30°.
export function renderEquatorialGrid(
  ctx: CanvasRenderingContext2D,
  project: EqProjector,
  alpha: number
): void {
  if (alpha <= 0.01) return;
  ctx.strokeStyle = `rgba(110,140,180,${(0.18 * alpha).toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let ra = 0; ra < 360; ra += 30) {
    const meridian: Array<[number, number]> = [];
    for (let dec = -80; dec <= 80; dec += 4) meridian.push([ra, dec]);
    strokePath(ctx, project, meridian);
  }
  for (let dec = -60; dec <= 60; dec += 30) {
    const parallel: Array<[number, number]> = [];
    for (let ra = 0; ra <= 360; ra += 4) parallel.push([ra, dec]);
    strokePath(ctx, project, parallel);
  }
  ctx.stroke();
}

// The meridian: the great circle through due north, the zenith, and due south.
// Drawn in the horizontal frame (it's fixed to the observer, not the stars).
export function renderMeridian(
  ctx: CanvasRenderingContext2D,
  project: AltAzProjector,
  alpha: number
): void {
  if (alpha <= 0.01) return;
  ctx.strokeStyle = `rgba(150,180,220,${(0.22 * alpha).toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  let prev: [number, number] | null = null;
  // North horizon → zenith → south horizon.
  for (let alt = 0; alt <= 90; alt += 3) {
    const p = project(alt, 0);
    if (p && prev) { ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); }
    prev = p;
  }
  prev = null;
  for (let alt = 90; alt >= 0; alt -= 3) {
    const p = project(alt, 180);
    if (p && prev) { ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); }
    prev = p;
  }
  ctx.stroke();
}

// The ecliptic, drawn as a soft gold path from a precomputed RA/Dec polyline.
export function renderEcliptic(
  ctx: CanvasRenderingContext2D,
  project: EqProjector,
  path: Array<[number, number]>,
  alpha: number
): void {
  if (alpha <= 0.01) return;
  ctx.strokeStyle = `rgba(230,200,120,${(0.4 * alpha).toFixed(3)})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  strokePath(ctx, project, path);
  ctx.stroke();
}
