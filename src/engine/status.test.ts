import { describe, it, expect } from "vitest";
import { idleStatus, STALE_TLE_DAYS } from "./status";

const DAY_MS = 86_400_000;
const fresh = { fromCache: true, ageMs: 1 * DAY_MS };

describe("idleStatus", () => {
  it("warns of offline degradation only when both catalog and TLEs are missing", () => {
    expect(idleStatus(false, false, fresh)).toMatch(/Offline/);
    expect(idleStatus(true, false, fresh)).not.toMatch(/Offline/);
    expect(idleStatus(false, true, fresh)).not.toMatch(/Offline/);
  });

  it("warns when cached satellite data is at or past the stale threshold", () => {
    const stale = { fromCache: true, ageMs: STALE_TLE_DAYS * DAY_MS };
    const msg = idleStatus(true, true, stale);
    expect(msg).toMatch(/Satellite data \d+ days old/);
    expect(msg).toContain(String(STALE_TLE_DAYS));
  });

  it("rounds the reported age", () => {
    const stale = { fromCache: true, ageMs: 4.6 * DAY_MS };
    expect(idleStatus(true, true, stale)).toContain("5 days");
  });

  it("stays blank for fresh cached data", () => {
    expect(idleStatus(true, true, fresh)).toBe("");
  });

  it("stays blank for freshly fetched (not-from-cache) data", () => {
    expect(idleStatus(true, true, { fromCache: false, ageMs: null })).toBe("");
  });

  it("stays blank when age is unknown", () => {
    expect(idleStatus(true, true, { fromCache: true, ageMs: null })).toBe("");
  });

  it("offline message wins even if TLE meta looks stale", () => {
    // hasTles false short-circuits before the stale check is reachable in practice;
    // assert the offline branch takes precedence regardless of meta.
    expect(idleStatus(false, false, { fromCache: true, ageMs: 30 * DAY_MS })).toMatch(/Offline/);
  });
});
