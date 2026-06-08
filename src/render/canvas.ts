// Projects a celestial coordinate (RA/Dec, degrees) to canvas pixels, or null when
// it should not be drawn (below the horizon, or outside the AR field of view). The
// orchestrator builds this by composing equatorialToHorizontal with the active
// projection, so render modules stay free of astronomy math.
export type EqProjector = (ra: number, dec: number) => [number, number] | null;

// Same idea but in the horizontal frame (alt/az degrees) — for horizon-fixed
// reference lines like the meridian.
export type AltAzProjector = (alt: number, az: number) => [number, number] | null;

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

  rc.ctx.textAlign = "center";
  rc.ctx.textBaseline = "middle";

  // Tick marks at every cardinal/intercardinal, just outside the rim.
  for (const { az } of labels) {
    const azRad = az * (Math.PI / 180);
    const isCardinal = labels.find((l) => l.az === az)!.label.length === 1;
    const inner = rc.radius + 3;
    const outer = rc.radius + (isCardinal ? 9 : 6);
    rc.ctx.strokeStyle = isCardinal ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)";
    rc.ctx.lineWidth = 1;
    rc.ctx.beginPath();
    rc.ctx.moveTo(rc.centerX + inner * Math.sin(azRad), rc.centerY - inner * Math.cos(azRad));
    rc.ctx.lineTo(rc.centerX + outer * Math.sin(azRad), rc.centerY - outer * Math.cos(azRad));
    rc.ctx.stroke();
  }

  // Letter-spaced, instrument-style labels — cardinals brighter than intercardinals.
  for (const { label, az } of labels) {
    const azRad = az * (Math.PI / 180);
    const isCardinal = label.length === 1;
    const r = rc.radius + (isCardinal ? 22 : 18);
    const x = rc.centerX + r * Math.sin(azRad);
    const y = rc.centerY - r * Math.cos(azRad);

    rc.ctx.fillStyle = isCardinal ? "rgba(255,255,255,0.82)" : "rgba(180,195,225,0.4)";
    rc.ctx.font = isCardinal
      ? '600 12px ui-sans-serif, system-ui, sans-serif'
      : '500 10px ui-sans-serif, system-ui, sans-serif';
    // Manual letter-spacing for the 2-char intercardinals (canvas has no tracking).
    if (isCardinal) {
      rc.ctx.fillText(label, x, y);
    } else {
      rc.ctx.fillText(label.split("").join(" "), x, y);
    }
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

// Converts alt/az to x/y for a pointed view (AR mode) via a true gnomonic
// (pinhole-camera / tangent-plane) projection centered on centerAlt/centerAz.
// This is the correct camera model: an object N degrees off-axis maps to
// tan(N)·focal pixels from center, so spacing is right everywhere — including
// near the zenith, where the old (Δaz, Δalt) approximation over-spread objects
// because azimuth wasn't scaled by cos(alt). fov is the full field of view (deg).
export function altAzToXYPointed(
  alt: number,
  az: number,
  centerAlt: number,
  centerAz: number,
  fov: number,
  rc: RenderContext
): [number, number] | null {
  const altRad = alt * (Math.PI / 180);
  const cAltRad = centerAlt * (Math.PI / 180);
  const dAz = (az - centerAz) * (Math.PI / 180);

  // Cosine of the angular distance from the aim point.
  const cosC =
    Math.sin(altRad) * Math.sin(cAltRad) +
    Math.cos(altRad) * Math.cos(cAltRad) * Math.cos(dAz);

  // Behind the camera (≥ 90° away): gnomonic projection diverges — drop it.
  if (cosC <= 1e-6) return null;

  const angDist = Math.acos(Math.max(-1, Math.min(1, cosC))) * (180 / Math.PI);
  if (angDist > fov / 2) return null; // outside the (circular) field of view

  // Tangent-plane coordinates (these are tan of the off-axis angle).
  const xt = (Math.cos(altRad) * Math.sin(dAz)) / cosC;
  const yt =
    (Math.cos(cAltRad) * Math.sin(altRad) -
      Math.sin(cAltRad) * Math.cos(altRad) * Math.cos(dAz)) /
    cosC;

  // Focal length so that an object at fov/2 off-axis lands at the screen edge.
  const focal = (Math.min(rc.width, rc.height) / 2) / Math.tan((fov / 2) * (Math.PI / 180));

  const x = rc.centerX + xt * focal;
  const y = rc.centerY - yt * focal;
  return [x, y];
}