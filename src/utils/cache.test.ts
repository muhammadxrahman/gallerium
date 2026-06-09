import { describe, it, expect } from "vitest";
import { isExpired } from "./cache";

// The IndexedDB plumbing in cache.ts is thin and standard; the one decision worth
// testing is staleness. (Full IndexedDB integration would need a fake-indexeddb
// dev-dependency.) `now` is injected so the test is deterministic.
describe("isExpired", () => {
  const t0 = 1_000_000;

  it("never expires when no maxAge is given", () => {
    expect(isExpired(t0, undefined, t0 + 10 ** 9)).toBe(false);
    expect(isExpired(t0, 0, t0 + 10 ** 9)).toBe(false); // 0 = "no expiry"
  });

  it("is fresh within the window and stale past it", () => {
    expect(isExpired(t0, 1000, t0 + 500)).toBe(false); // 0.5s old, max 1s
    expect(isExpired(t0, 1000, t0 + 1500)).toBe(true); // 1.5s old, max 1s
  });

  it("treats exactly-at-the-limit as still fresh (strictly greater is expired)", () => {
    expect(isExpired(t0, 1000, t0 + 1000)).toBe(false);
    expect(isExpired(t0, 1000, t0 + 1001)).toBe(true);
  });

  it("matches the real cache ages (1 week stars, 24 h TLEs)", () => {
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const DAY = 24 * 60 * 60 * 1000;
    expect(isExpired(t0, WEEK, t0 + WEEK - 1)).toBe(false);
    expect(isExpired(t0, WEEK, t0 + WEEK + 1)).toBe(true);
    expect(isExpired(t0, DAY, t0 + DAY + 1)).toBe(true);
  });
});
