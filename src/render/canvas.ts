export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  radius: number; // usable radius of the sky dome
}

export function initCanvas(canvas: HTMLCanvasElement): RenderContext {
  const ctx = canvas.getContext("2d")!;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // Handle retina/high-DPI screens. Only resize the backing store when it
  // actually changed — assigning canvas.width/height reallocates and clears the
  // buffer, so doing it every frame is a needless drain. setTransform applies the
  // DPR scale idempotently (unlike scale(), which would compound each call).
  const dpr = window.devicePixelRatio || 1;
  const backingW = Math.round(width * dpr);
  const backingH = Math.round(height * dpr);
  if (canvas.width !== backingW || canvas.height !== backingH) {
    canvas.width = backingW;
    canvas.height = backingH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return {
    canvas,
    ctx,
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    radius: Math.min(width, height) / 2 * 0.9,
  };
}

export function clearCanvas(rc: RenderContext): void {
  rc.ctx.fillStyle = "#000008";
  rc.ctx.fillRect(0, 0, rc.width, rc.height);
}

// Convert altitude/azimuth to canvas x/y using stereographic projection
// Az=0 is North, increases clockwise. Alt=90 is center, Alt=0 is edge.
export function altAzToXY(
  alt: number,
  az: number,
  rc: RenderContext
): [number, number] {
  const altRad = alt * (Math.PI / 180);
  const azRad = az * (Math.PI / 180);

  // Distance from center: 0 at zenith, 1 at horizon
  const r = rc.radius * (1 - altRad / (Math.PI / 2));

  const x = rc.centerX + r * Math.sin(azRad);
  const y = rc.centerY - r * Math.cos(azRad);

  return [x, y];
}

export function isVisible(alt: number): boolean {
  return alt > 0;
}

export function renderCompass(rc: RenderContext): void {
  const labels = [
    { label: "N", az: 0 },
    { label: "E", az: 90 },
    { label: "S", az: 180 },
    { label: "W", az: 270 },
    { label: "NE", az: 45 },
    { label: "SE", az: 135 },
    { label: "SW", az: 225 },
    { label: "NW", az: 315 },
  ];

  rc.ctx.font = "bold 13px sans-serif";
  rc.ctx.textAlign = "center";
  rc.ctx.textBaseline = "middle";

  for (const { label, az } of labels) {
    const azRad = az * (Math.PI / 180);
    const isCardinal = label.length === 1;

    // Place just outside the sky dome edge
    const r = rc.radius + (isCardinal ? 18 : 14);
    const x = rc.centerX + r * Math.sin(azRad);
    const y = rc.centerY - r * Math.cos(azRad);

    rc.ctx.fillStyle = isCardinal
      ? "rgba(255, 255, 255, 0.9)"
      : "rgba(255, 255, 255, 0.45)";

    rc.ctx.font = isCardinal
      ? "bold 13px sans-serif"
      : "11px sans-serif";

    rc.ctx.fillText(label, x, y);
  }

  // Horizon ring
  rc.ctx.beginPath();
  rc.ctx.arc(rc.centerX, rc.centerY, rc.radius, 0, Math.PI * 2);
  rc.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  rc.ctx.lineWidth = 1;
  rc.ctx.stroke();

  // Reset text alignment
  rc.ctx.textAlign = "left";
  rc.ctx.textBaseline = "alphabetic";
}

// Converts alt/az to x/y for a pointed view (AR mode)
// centerAz/centerAlt is where the phone is pointing
// fov is field of view in degrees
export function altAzToXYPointed(
  alt: number,
  az: number,
  centerAlt: number,
  centerAz: number,
  fov: number,
  rc: RenderContext
): [number, number] | null {
  // Angular distance from center point
  const altRad = alt * (Math.PI / 180);
  const azRad = az * (Math.PI / 180);
  const cAltRad = centerAlt * (Math.PI / 180);
  const cAzRad = centerAz * (Math.PI / 180);

  const cosD =
    Math.sin(altRad) * Math.sin(cAltRad) +
    Math.cos(altRad) * Math.cos(cAltRad) * Math.cos(azRad - cAzRad);

  const angDist = Math.acos(Math.max(-1, Math.min(1, cosD))) * (180 / Math.PI);
  if (angDist > fov / 2) return null; // outside field of view

  // Project onto screen
  const scale = Math.min(rc.width, rc.height) / fov;
  const dAz = (az - centerAz + 540) % 360 - 180;
  const dAlt = alt - centerAlt;

  const x = rc.centerX + dAz * scale;
  const y = rc.centerY - dAlt * scale;

  return [x, y];
}