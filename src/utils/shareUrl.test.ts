import { describe, it, expect } from "vitest";
import { encodeShareState, parseShareState } from "./shareUrl";

describe("shareUrl encode/parse", () => {
  it("round-trips a full state", () => {
    const parsed = parseShareState(
      encodeShareState({
        latitude: 40.7128,
        longitude: -74.006,
        time: 1_700_000_000_000,
        zoom: 2.5,
        target: "planet:Jupiter",
      })
    );
    expect(parsed.latitude).toBeCloseTo(40.7128, 3);
    expect(parsed.longitude).toBeCloseTo(-74.006, 3);
    expect(parsed.time).toBe(1_700_000_000_000);
    expect(parsed.zoom).toBeCloseTo(2.5, 2);
    expect(parsed.target).toBe("planet:Jupiter");
  });

  it("omits undefined fields and a default zoom of 1", () => {
    expect(encodeShareState({})).toBe("");
    expect(encodeShareState({ zoom: 1 })).toBe("");
    const p = new URLSearchParams(encodeShareState({ latitude: 10, longitude: 20 }));
    expect(p.get("lat")).toBe("10.0000");
    expect(p.get("lon")).toBe("20.0000");
    expect(p.has("t")).toBe(false);
    expect(p.has("z")).toBe(false);
    expect(p.has("o")).toBe(false);
  });

  it("treats location as all-or-nothing (a lone latitude is dropped)", () => {
    expect(encodeShareState({ latitude: 10 })).toBe("");
    expect(parseShareState("lat=10").latitude).toBeUndefined();
  });

  it("rejects out-of-range coordinates", () => {
    expect(parseShareState("lat=200&lon=10").latitude).toBeUndefined();
    expect(parseShareState("lat=10&lon=999").longitude).toBeUndefined();
  });

  it("ignores garbage and non-positive time/zoom", () => {
    expect(parseShareState("lat=abc&lon=def")).toEqual({});
    expect(parseShareState("t=0").time).toBeUndefined();
    expect(parseShareState("t=-5").time).toBeUndefined();
    expect(parseShareState("z=0").zoom).toBeUndefined();
  });

  it("tolerates a leading ? and an empty query", () => {
    expect(parseShareState("?lat=10&lon=20").latitude).toBe(10);
    expect(parseShareState("")).toEqual({});
  });
});
