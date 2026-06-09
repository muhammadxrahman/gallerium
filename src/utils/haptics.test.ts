import { describe, it, expect } from "vitest";
import { lockHaptic, LOCK_DEG, REARM_DEG } from "./haptics";

describe("lockHaptic (hysteresis)", () => {
  it("pulses once on entering the lock zone, then disarms", () => {
    const r = lockHaptic(LOCK_DEG - 0.5, true);
    expect(r).toEqual({ pulse: true, armed: false });
  });

  it("does not pulse again while still locked (already disarmed)", () => {
    expect(lockHaptic(0.2, false)).toEqual({ pulse: false, armed: false });
  });

  it("re-arms only after drifting past the wider re-arm zone", () => {
    expect(lockHaptic(REARM_DEG - 0.5, false)).toEqual({ pulse: false, armed: false }); // between zones: stay disarmed
    expect(lockHaptic(REARM_DEG + 0.5, false)).toEqual({ pulse: false, armed: true });
  });

  it("stays armed (no pulse) while the target is far", () => {
    expect(lockHaptic(30, true)).toEqual({ pulse: false, armed: true });
  });

  it("fires once across a full approach → leave → approach cycle", () => {
    let armed = true;
    const seq = [30, 10, 2, 1, 2, 10, 1]; // far, far, lock, hold, leave-a-bit, re-arm, lock again
    const pulses: number[] = [];
    seq.forEach((d, i) => {
      const r = lockHaptic(d, armed);
      armed = r.armed;
      if (r.pulse) pulses.push(i);
    });
    expect(pulses).toEqual([2, 6]); // locked at index 2, re-armed by index 5, locked again at 6
  });
});
