import { describe, it, expect } from "vitest";
import { pickObject } from "./HitDetection";
import { altAzToXY, type AltAzProjector, type RenderContext } from "../render/canvas";
import type { RenderedStar } from "../render/stars";
import type { RenderedPlanet } from "../render/planets";
import type { RenderedSatellite } from "../render/satellites";
import type { RenderedMoon } from "../render/moon";
import type { RenderedSun } from "../render/sun";
import type { RenderedDeepSky } from "../render/deepSky";

function rc(overrides: Partial<RenderContext> = {}): RenderContext {
  return { width: 400, height: 400, centerX: 200, centerY: 200, radius: 180, ...overrides } as RenderContext;
}

// The map-view projector: culls below the horizon, like the real one.
function proj(context: RenderContext): AltAzProjector {
  return (alt, az) => (alt < 0 ? null : altAzToXY(alt, az, context));
}

const star = (alt: number, az: number, magnitude: number, id = 1): RenderedStar => ({
  id, ra: 0, dec: 0, magnitude, colorIndex: 0, az, alt,
});
const planet = (alt: number, az: number): RenderedPlanet => ({
  name: "Mars", ra: 0, dec: 0, magnitude: 0, phase: 1, az, alt,
});
const sat = (alt: number, az: number): RenderedSatellite => ({
  name: "ISS (ZARYA)", ra: 0, dec: 0, altitude: 420, az, alt,
});
const moon = (alt: number, az: number): RenderedMoon => ({
  ra: 0, dec: 0, phase: 0.5, illumination: 0.5, waxing: true, distanceKm: 385000, az, alt,
});
const sun = (alt: number, az: number): RenderedSun => ({ ra: 0, dec: 0, az, alt });
const dso = (alt: number, az: number, id = "M31"): RenderedDeepSky => ({
  id, name: "Andromeda Galaxy", ra: 0, dec: 0, magnitude: 3.4, kind: "galaxy", az, alt,
});

function at(alt: number, az: number, context = rc()): [number, number] {
  return altAzToXY(alt, az, context);
}

describe("pickObject", () => {
  it("returns null when nothing is near the click", () => {
    expect(pickObject(200, 200, proj(rc()), [], [], [], null, null)).toBeNull();
  });

  it("selects a star clicked at its projected position", () => {
    const s = star(90, 0, 1); // zenith → dome center (200,200)
    expect(pickObject(200, 200, proj(rc()), [s], [], [], null, null)).toEqual({ type: "star", data: s });
  });

  it("returns null when the click misses the object", () => {
    expect(pickObject(10, 10, proj(rc()), [star(90, 0, 1)], [], [], null, null)).toBeNull();
  });

  it("prefers the Sun over a coincident star (priority order)", () => {
    const [x, y] = at(90, 0);
    const result = pickObject(x, y, proj(rc()), [star(90, 0, 1)], [], [], null, sun(90, 0));
    expect(result?.type).toBe("sun");
  });

  it("prefers a planet over a coincident satellite", () => {
    const [x, y] = at(90, 0);
    const result = pickObject(x, y, proj(rc()), [], [planet(90, 0)], [sat(90, 0)], null, null);
    expect(result?.type).toBe("planet");
  });

  it("ignores the Sun and Moon when they are below the horizon", () => {
    const [x, y] = at(90, 0);
    const result = pickObject(x, y, proj(rc()), [star(90, 0, 1)], [], [], moon(-5, 0), sun(-10, 0));
    expect(result?.type).toBe("star");
  });

  it("ignores satellites below the 10° elevation cutoff", () => {
    const [x, y] = at(5, 0);
    expect(pickObject(x, y, proj(rc()), [], [], [sat(5, 0)], null, null)).toBeNull();
  });

  it("breaks ties between overlapping stars in favor of the brighter one", () => {
    const bright = star(90, 0, 1.0, 10);
    const faint = star(90, 0, 4.5, 20);
    expect(pickObject(200, 200, proj(rc()), [faint, bright], [], [], null, null)).toEqual({
      type: "star",
      data: bright,
    });
  });

  it("selects a deep-sky object clicked at its projected position", () => {
    const d = dso(90, 0);
    expect(pickObject(200, 200, proj(rc()), [], [], [], null, null, [d])).toEqual({
      type: "deepsky",
      data: d,
    });
  });

  it("prefers a coincident planet over a deep-sky object (priority order)", () => {
    const [x, y] = at(90, 0);
    const result = pickObject(x, y, proj(rc()), [], [planet(90, 0)], [], null, null, [dso(90, 0)]);
    expect(result?.type).toBe("planet");
  });

  it("prefers a deep-sky object over a coincident star", () => {
    const [x, y] = at(90, 0);
    const result = pickObject(x, y, proj(rc()), [star(90, 0, 3)], [], [], null, null, [dso(90, 0)]);
    expect(result?.type).toBe("deepsky");
  });

  it("uses the projector geometry so zoom/pan keeps hits aligned with the render", () => {
    const zoomed = rc({ radius: 360 }); // simulate applyView() zoom
    const s = star(45, 0, 1);
    const [x, y] = at(45, 0, zoomed);
    expect(pickObject(x, y, proj(zoomed), [s], [], [], null, null)).toEqual({ type: "star", data: s });
    // The same click misses at the un-zoomed radius (the projected position differs).
    expect(pickObject(x, y, proj(rc()), [s], [], [], null, null)).toBeNull();
  });
});
