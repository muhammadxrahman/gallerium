import { describe, it, expect, afterEach } from "vitest";
import { getSkyTime, isLive, setSkyTime, shiftSkyTime, goLive } from "./clock";

afterEach(() => goLive());

describe("clock", () => {
  it("is live by default and tracks the real clock", () => {
    expect(isLive()).toBe(true);
    expect(Math.abs(getSkyTime().getTime() - Date.now())).toBeLessThan(1000);
  });

  it("freezes at a set time", () => {
    const t = new Date("2030-07-04T22:00:00Z");
    setSkyTime(t);
    expect(isLive()).toBe(false);
    expect(getSkyTime().getTime()).toBe(t.getTime());
  });

  it("returns a copy so callers can't mutate the frozen time", () => {
    const t = new Date("2030-07-04T22:00:00Z");
    setSkyTime(t);
    getSkyTime().setFullYear(1999);
    expect(getSkyTime().getFullYear()).toBe(2030);
  });

  it("shifts time by a delta and stays frozen", () => {
    setSkyTime(new Date("2030-01-01T00:00:00Z"));
    shiftSkyTime(24 * 60 * 60 * 1000); // +1 day
    expect(getSkyTime().toISOString()).toBe("2030-01-02T00:00:00.000Z");
  });

  it("goLive() resumes the real clock", () => {
    setSkyTime(new Date("2000-01-01T00:00:00Z"));
    goLive();
    expect(isLive()).toBe(true);
    expect(Math.abs(getSkyTime().getTime() - Date.now())).toBeLessThan(1000);
  });
});
