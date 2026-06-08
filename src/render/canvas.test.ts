import { describe, it, expect } from "vitest";
import { altAzToXY, altAzToXYPointed, isVisible, type RenderContext } from "./canvas";

// altAzToXY/altAzToXYPointed only read geometry fields, not ctx/canvas, so a
// minimal stub is enough. 400x400 canvas, dome radius 180.
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

describe("altAzToXY (map dome projection)", () => {
  it("maps the zenith (alt 90) to the dome center", () => {
    const [x, y] = altAzToXY(90, 0, rc());
    expect(x).toBeCloseTo(200, 6);
    expect(y).toBeCloseTo(200, 6);
  });

  it("places the cardinal horizon points correctly (N up, E right, S down, W left)", () => {
    const expectPoint = (got: [number, number], ex: number, ey: number) => {
      expect(got[0]).toBeCloseTo(ex, 6);
      expect(got[1]).toBeCloseTo(ey, 6);
    };
    expectPoint(altAzToXY(0, 0, rc()), 200, 20); // North → top
    expectPoint(altAzToXY(0, 90, rc()), 380, 200); // East → right
    expectPoint(altAzToXY(0, 180, rc()), 200, 380); // South → bottom
    expectPoint(altAzToXY(0, 270, rc()), 20, 200); // West → left
  });

  it("scales radius linearly with zenith distance (alt 45 is halfway out)", () => {
    const [x, y] = altAzToXY(45, 0, rc());
    expect(x).toBeCloseTo(200, 6);
    expect(y).toBeCloseTo(200 - 90, 6); // half of radius 180, toward North (up)
  });

  it("plots below-horizon objects outside the dome (r > radius)", () => {
    const [x, y] = altAzToXY(-10, 0, rc());
    const d = Math.hypot(x - 200, y - 200);
    expect(d).toBeGreaterThan(180);
  });

  it("honors the rc radius (zoom): doubling radius doubles the offset from center", () => {
    const [, y1] = altAzToXY(45, 0, rc({ radius: 180 }));
    const [, y2] = altAzToXY(45, 0, rc({ radius: 360 }));
    expect(200 - y2).toBeCloseTo((200 - y1) * 2, 6);
  });
});

describe("altAzToXYPointed (AR / pointed projection)", () => {
  it("maps the aim point to the screen center", () => {
    const pos = altAzToXYPointed(30, 100, 30, 100, 90, rc());
    expect(pos).not.toBeNull();
    expect(pos![0]).toBeCloseTo(200, 6);
    expect(pos![1]).toBeCloseTo(200, 6);
  });

  it("culls objects beyond half the field of view", () => {
    // 60° away with a 90° FOV (half = 45°) → out of view
    expect(altAzToXYPointed(0, 60, 0, 0, 90, rc())).toBeNull();
    // 30° away is within view
    expect(altAzToXYPointed(0, 30, 0, 0, 90, rc())).not.toBeNull();
  });

  it("puts higher-altitude objects up the screen and lower ones down", () => {
    const up = altAzToXYPointed(20, 0, 0, 0, 90, rc())!;
    const down = altAzToXYPointed(-20, 0, 0, 0, 90, rc())!;
    expect(up[1]).toBeLessThan(200); // up = smaller y
    expect(down[1]).toBeGreaterThan(200);
    // symmetric about center
    expect(200 - up[1]).toBeCloseTo(down[1] - 200, 6);
    expect(up[0]).toBeCloseTo(200, 6);
  });

  it("puts objects east of the aim point to the right", () => {
    const east = altAzToXYPointed(0, 10, 0, 0, 90, rc())!;
    expect(east[0]).toBeGreaterThan(200);
    expect(east[1]).toBeCloseTo(200, 6);
  });

  it("uses the shortest signed azimuth difference across the 0/360 wrap", () => {
    // aim at az 350, object at az 10 → 20° to the east (right), not 340° west
    const pos = altAzToXYPointed(0, 10, 0, 350, 90, rc())!;
    expect(pos[0]).toBeGreaterThan(200); // east → right (short way), not far left
    expect(pos[1]).toBeCloseTo(200, 6);
  });

  it("is gnomonic: an object at fov/2 off-axis lands at the screen edge", () => {
    // 45° to the side with a 90° FOV → exactly the right edge (x = 400).
    const pos = altAzToXYPointed(0, 45, 0, 0, 90, rc())!;
    expect(pos[0]).toBeCloseTo(400, 4);
    expect(pos[1]).toBeCloseTo(200, 6);
  });

  it("is gnomonic: off-axis offset scales as tan(angle)·focal (not linearly)", () => {
    // focal = (min(w,h)/2) / tan(45°) = 200. A 30° horizontal offset → tan30·200.
    const pos = altAzToXYPointed(0, 30, 0, 0, 90, rc())!;
    expect(pos[0] - 200).toBeCloseTo(Math.tan((30 * Math.PI) / 180) * 200, 4);
  });

  it("rejects points behind the camera (≥90° from the aim point)", () => {
    expect(altAzToXYPointed(0, 100, 0, 0, 90, rc())).toBeNull();
  });
});

describe("isVisible", () => {
  it("is true only strictly above the horizon", () => {
    expect(isVisible(10)).toBe(true);
    expect(isVisible(0)).toBe(false);
    expect(isVisible(-1)).toBe(false);
  });
});
