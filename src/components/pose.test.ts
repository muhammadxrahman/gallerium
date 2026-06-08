import { describe, it, expect } from "vitest";
import { poseToHorizontal } from "./pose";

describe("poseToHorizontal (device pose → alt/az)", () => {
  it("points straight down when the phone lies flat, screen up", () => {
    // Back of the phone faces the ground → altitude -90.
    expect(poseToHorizontal({ alpha: 0, beta: 0, gamma: 0 }).altitude).toBeCloseTo(-90, 4);
  });

  it("points at the zenith when the phone lies flat, screen down", () => {
    // The old `90 - |beta|` reported -90 here; the correct answer is +90.
    expect(poseToHorizontal({ alpha: 0, beta: 180, gamma: 0 }).altitude).toBeCloseTo(90, 4);
  });

  it("points at the horizon when the phone is held vertically", () => {
    expect(poseToHorizontal({ alpha: 0, beta: 90, gamma: 0 }).altitude).toBeCloseTo(0, 4);
  });

  it("tracks intermediate tilts (45° and 135°)", () => {
    expect(poseToHorizontal({ alpha: 0, beta: 45, gamma: 0 }).altitude).toBeCloseTo(-45, 4);
    expect(poseToHorizontal({ alpha: 0, beta: 135, gamma: 0 }).altitude).toBeCloseTo(45, 4);
  });

  it("accounts for roll (gamma), which the old model ignored", () => {
    // Rolled onto its side from vertical → still looking at the horizon.
    expect(poseToHorizontal({ alpha: 0, beta: 90, gamma: 90 }).altitude).toBeCloseTo(0, 4);
    // Flat-ish but rolled 90° → camera points to the horizon, not the ground.
    expect(poseToHorizontal({ alpha: 0, beta: 0, gamma: 90 }).altitude).toBeCloseTo(0, 4);
  });

  it("gives a north-referenced azimuth for a vertically held phone", () => {
    const az = poseToHorizontal({ alpha: 0, beta: 90, gamma: 0 }).azimuth;
    expect(az).toBeCloseTo(0, 4); // pointing north
  });
});
