import { describe, it, expect } from "vitest";
import { formatRA, formatDec } from "./coordFormat";

describe("formatRA", () => {
  it("converts degrees to hours/minutes", () => {
    expect(formatRA(0)).toBe("0h 0m");
    expect(formatRA(90)).toBe("6h 0m");
    expect(formatRA(180)).toBe("12h 0m");
    expect(formatRA(270)).toBe("18h 0m");
  });

  it("matches a known position (Orion Nebula RA 83.82° ≈ 5h 35m)", () => {
    expect(formatRA(83.82)).toBe("5h 35m");
  });

  it("wraps negative and >360 input", () => {
    expect(formatRA(-90)).toBe("18h 0m");
    expect(formatRA(360)).toBe("0h 0m");
  });

  it("carries 60 minutes without overflowing", () => {
    expect(formatRA(359.99)).toBe("0h 0m"); // rounds up to 24h → wraps to 0
  });
});

describe("formatDec", () => {
  it("formats signed degrees/arcminutes", () => {
    expect(formatDec(0)).toBe("+0° 0′");
    expect(formatDec(22.02)).toBe("+22° 1′");
    expect(formatDec(-5.39)).toBe("-5° 23′");
  });

  it("carries 60 arcminutes", () => {
    expect(formatDec(22.999)).toBe("+23° 0′");
  });
});
