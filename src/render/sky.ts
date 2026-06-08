import { type RenderContext, altAzToXY } from "./canvas";

type RGB = [number, number, number];

// Sky color keypoints by Sun altitude (deg): [zenith, horizon].
// From full day → golden hour → civil/nautical/astronomical twilight → night.
const STOPS: Array<{ alt: number; zenith: RGB; horizon: RGB }> = [
  { alt: 60, zenith: [38, 104, 184], horizon: [122, 170, 222] },
  { alt: 10, zenith: [42, 98, 170], horizon: [150, 180, 220] },
  { alt: 2, zenith: [44, 86, 150], horizon: [224, 168, 120] },
  { alt: 0, zenith: [38, 64, 120], horizon: [240, 138, 84] },
  { alt: -4, zenith: [26, 40, 86], horizon: [200, 96, 96] },
  { alt: -8, zenith: [16, 26, 62], horizon: [96, 60, 104] },
  { alt: -12, zenith: [9, 15, 40], horizon: [34, 36, 78] },
  { alt: -18, zenith: [5, 8, 22], horizon: [14, 18, 42] },
  { alt: -90, zenith: [3, 5, 14], horizon: [9, 12, 28] },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function rgb(c: RGB, alpha = 1): string {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha})`;
}

export interface SkyTone {
  zenith: RGB;
  horizon: RGB;
}

export function skyTone(sunAlt: number): SkyTone {
  if (sunAlt >= STOPS[0].alt) return { zenith: STOPS[0].zenith, horizon: STOPS[0].horizon };
  for (let i = 0; i < STOPS.length - 1; i++) {
    const hi = STOPS[i];
    const lo = STOPS[i + 1];
    if (sunAlt <= hi.alt && sunAlt >= lo.alt) {
      const t = (hi.alt - sunAlt) / (hi.alt - lo.alt);
      return { zenith: lerpRGB(hi.zenith, lo.zenith, t), horizon: lerpRGB(hi.horizon, lo.horizon, t) };
    }
  }
  const last = STOPS[STOPS.length - 1];
  return { zenith: last.zenith, horizon: last.horizon };
}

// 0 = stars washed out by daylight, 1 = fully dark sky. Smooth across twilight.
export function starVisibility(sunAlt: number): number {
  // Fully visible by the end of nautical twilight (-12°), gone by sunrise (0°).
  const t = (-sunAlt) / 12;
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c); // smoothstep
}

// Map (dome) view: radial gradient zenith(center) → horizon(edge), plus a warm
// directional glow toward the Sun when it's near/below the horizon.
export function renderSkyDome(rc: RenderContext, sunAlt: number, sunAz: number): void {
  const tone = skyTone(sunAlt);

  // Deep background fill behind everything (covers corners outside the dome).
  rc.ctx.fillStyle = rgb(skyTone(-90).zenith);
  rc.ctx.fillRect(0, 0, rc.width, rc.height);

  const grad = rc.ctx.createRadialGradient(
    rc.centerX,
    rc.centerY,
    0,
    rc.centerX,
    rc.centerY,
    rc.radius
  );
  grad.addColorStop(0, rgb(tone.zenith));
  grad.addColorStop(0.7, rgb(lerpRGB(tone.zenith, tone.horizon, 0.6)));
  grad.addColorStop(1, rgb(tone.horizon));

  rc.ctx.fillStyle = grad;
  rc.ctx.beginPath();
  rc.ctx.arc(rc.centerX, rc.centerY, rc.radius, 0, Math.PI * 2);
  rc.ctx.fill();

  // Twilight glow at the Sun's horizon bearing.
  if (sunAlt < 8 && sunAlt > -14) {
    const [gx, gy] = altAzToXY(0, sunAz, rc);
    const strength = Math.max(0, 1 - Math.abs(sunAlt + 3) / 11);
    const glow = rc.ctx.createRadialGradient(gx, gy, 0, gx, gy, rc.radius * 0.9);
    glow.addColorStop(0, rgb([255, 170, 90], 0.55 * strength));
    glow.addColorStop(1, "transparent");
    rc.ctx.save();
    rc.ctx.beginPath();
    rc.ctx.arc(rc.centerX, rc.centerY, rc.radius, 0, Math.PI * 2);
    rc.ctx.clip();
    rc.ctx.fillStyle = glow;
    rc.ctx.fillRect(0, 0, rc.width, rc.height);
    rc.ctx.restore();
  }

  // Depth: a soft vignette toward the dome edge.
  const vig = rc.ctx.createRadialGradient(
    rc.centerX,
    rc.centerY,
    rc.radius * 0.55,
    rc.centerX,
    rc.centerY,
    rc.radius
  );
  vig.addColorStop(0, "transparent");
  vig.addColorStop(1, "rgba(0,0,5,0.38)");
  rc.ctx.save();
  rc.ctx.beginPath();
  rc.ctx.arc(rc.centerX, rc.centerY, rc.radius, 0, Math.PI * 2);
  rc.ctx.clip();
  rc.ctx.fillStyle = vig;
  rc.ctx.fillRect(0, 0, rc.width, rc.height);
  rc.ctx.restore();

  // A thin glassy rim where the dome meets the horizon.
  rc.ctx.strokeStyle = "rgba(170,195,255,0.22)";
  rc.ctx.lineWidth = 1.5;
  rc.ctx.beginPath();
  rc.ctx.arc(rc.centerX, rc.centerY, rc.radius, 0, Math.PI * 2);
  rc.ctx.stroke();
}

// Sky (AR) view: vertical gradient + a ground band below the straight-ahead horizon.
export function renderSkyAR(
  rc: RenderContext,
  sunAlt: number,
  horizonY: number
): void {
  const tone = skyTone(sunAlt);
  const grad = rc.ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
  grad.addColorStop(0, rgb(tone.zenith));
  grad.addColorStop(1, rgb(tone.horizon));
  rc.ctx.fillStyle = grad;
  rc.ctx.fillRect(0, 0, rc.width, rc.height);

  // Ground below the horizon.
  if (horizonY < rc.height) {
    const ground = rc.ctx.createLinearGradient(0, horizonY, 0, rc.height);
    ground.addColorStop(0, rgb(lerpRGB(tone.horizon, [10, 12, 16], 0.5)));
    ground.addColorStop(1, "rgba(4,5,8,1)");
    rc.ctx.fillStyle = ground;
    rc.ctx.fillRect(0, horizonY, rc.width, rc.height - horizonY);

    rc.ctx.strokeStyle = "rgba(255,255,255,0.12)";
    rc.ctx.lineWidth = 1;
    rc.ctx.beginPath();
    rc.ctx.moveTo(0, horizonY);
    rc.ctx.lineTo(rc.width, horizonY);
    rc.ctx.stroke();
  }
}
