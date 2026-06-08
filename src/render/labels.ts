// Frame-scoped label declutterer. Call beginLabels() once at the start of a draw,
// then drawLabel() for each label in priority order (most important first). A label
// is skipped if it would overlap one already placed, so the sky never turns into a
// pile of overlapping text. Bright/important things are drawn first and win.

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

let placed: Rect[] = [];

export function beginLabels(): void {
  placed = [];
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export interface LabelOpts {
  font?: string;
  fill?: string;
  size?: number; // approximate cap height for collision box
  padding?: number;
}

// Draws `text` with its left baseline near (x, y) unless it collides with an
// already-placed label. Returns true if drawn.
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: LabelOpts = {}
): boolean {
  const font = opts.font ?? "12px ui-sans-serif, system-ui, sans-serif";
  const size = opts.size ?? 12;
  const pad = opts.padding ?? 2;

  ctx.font = font;
  const w = ctx.measureText(text).width;
  const box: Rect = { x: x - pad, y: y - size, w: w + pad * 2, h: size + pad };

  for (const r of placed) {
    if (intersects(box, r)) return false;
  }
  placed.push(box);

  ctx.fillStyle = opts.fill ?? "rgba(255,255,255,0.85)";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
  return true;
}
