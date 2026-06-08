import { describe, it, expect } from "vitest";
import { pickObject } from "./HitDetection";
import { altAzToXY, type RenderContext } from "../render/canvas";
import type { RenderedStar } from "../render/stars";
import type { RenderedPlanet } from "../render/planets";
import type { RenderedSatellite } from "../render/satellites";
import type { RenderedMoon } from "../render/moon";
import type { RenderedSun } from "../render/sun";

function rc(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    width: 400,
    height: 400,
    centerX: 200,
    centerY: 200,
    radius: 180,
    ...overrides,
  } as RenderContext;
}

const star = (alt: number, az: number, magnitude: number, id = 1): RenderedStar => ({
  id,
  ra: 0,
  dec: 0,
  magnitude,
  colorIndex: 0,
  az,
  alt,
});
const planet = (alt: number, az: number): RenderedPlanet => ({
  name: "Mars",
  ra: 0,
  dec: 0,
  magnitude: 0,
  az,
  alt,
});
const sat = (alt: number, az: number): RenderedSatellite => ({
  name: "ISS (ZARYA)",
  ra: 0,
  dec: 0,
  altitude: 420,
  az,
  alt,
});
const moon = (alt: number, az: number): RenderedMoon => ({
  ra: 0,
  dec: 0,
  phase: 0.5,
  illumination: 0.5,
  waxing: true,
  az,
  alt,
});
const sun = (alt: number, az: number): RenderedSun => ({ ra: 0, dec: 0, az, alt });

// Click at exactly where an alt/az projects on the dome.
function at(alt: number, az: number, context = rc()): [number, number] {
  return altAzToXY(alt, az, context);
}

describe("pickObject", () => {
  it("returns null when nothing is near the click", () => {
    const result = pickObject(200, 200, rc(), [], [], [], null, null);
    expect(result).toBeNull();
  });

  it("selects a star clicked at its projected position", () => {
    const s = star(90, 0, 1); // zenith → dome center (200,200)
    const result = pickObject(200, 200, rc(), [s], [], [], null, null);
    expect(result).toEqual({ type: "star", data: s });
  });

  it("returns null when the click misses the object", () => {
    const s = star(90, 0, 1);
    const result = pickObject(10, 10, rc(), [s], [], [], null, null);
    expect(result).toBeNull();
  });

  it("prefers the Sun over a coincident star (priority order)", () => {
    const [x, y] = at(90, 0);
    const result = pickObject(x, y, rc(), [star(90, 0, 1)], [], [], null, sun(90, 0));
    expect(result?.type).toBe("sun");
  });

  it("prefers a planet over a coincident satellite", () => {
    const [x, y] = at(90, 0);
    const result = pickObject(x, y, rc(), [], [planet(90, 0)], [sat(90, 0)], null, null);
    expect(result?.type).toBe("planet");
  });

  it("ignores the Sun and Moon when they are below the horizon", () => {
    const [x, y] = at(90, 0);
    const result = pickObject(
      x,
      y,
      rc(),
      [star(90, 0, 1)],
      [],
      [],
      moon(-5, 0),
      sun(-10, 0)
    );
    expect(result?.type).toBe("star");
  });

  it("ignores satellites below the 10° elevation cutoff", () => {
    const lowSat = sat(5, 0);
    const [x, y] = at(5, 0);
    const result = pickObject(x, y, rc(), [], [], [lowSat], null, null);
    expect(result).toBeNull();
  });

  it("breaks ties between overlapping stars in favor of the brighter one", () => {
    const bright = star(90, 0, 1.0, 10);
    const faint = star(90, 0, 4.5, 20);
    const result = pickObject(200, 200, rc(), [faint, bright], [], [], null, null);
    expect(result).toEqual({ type: "star", data: bright });
  });

  it("uses the rc geometry so zoom/pan keeps hits aligned with the render", () => {
    const zoomed = rc({ radius: 360 }); // simulate applyView() zoom
    const s = star(45, 0, 1);
    const [x, y] = at(45, 0, zoomed); // projected position under zoom
    expect(pickObject(x, y, zoomed, [s], [], [], null, null)).toEqual({
      type: "star",
      data: s,
    });
    // The same click would miss at the un-zoomed radius (position differs)
    expect(pickObject(x, y, rc(), [s], [], [], null, null)).toBeNull();
  });
});
