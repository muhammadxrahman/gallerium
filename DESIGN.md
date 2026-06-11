# Design Notes

This document explains the interesting engineering in Gallerium: the problems that were
genuinely hard, the decisions made, and why. It is meant to be read top to bottom, but each
section stands on its own. For a full file-by-file map, see [CLAUDE.md](CLAUDE.md).

**The hard problems, in order:**

1. [The constraint that shaped everything](#1-the-constraint-that-shaped-everything)
2. [One coordinate pipeline for everything](#2-one-coordinate-pipeline-for-everything)
3. [Why satellites need different math](#3-why-satellites-need-different-math)
4. [Two projections behind one renderer](#4-two-projections-behind-one-renderer)
5. [A render loop that respects the battery](#5-a-render-loop-that-respects-the-battery)
6. [Moving the hot path off the main thread](#6-moving-the-hot-path-off-the-main-thread)
7. [How I know the math is right](#7-how-i-know-the-math-is-right)
8. [Architecture and testing](#8-architecture-and-testing)
9. [Things I chose not to do](#9-things-i-chose-not-to-do)

---

## 1. The constraint that shaped everything

The defining decision was to compute every celestial position **on the device, from published
algorithms**, with no backend, no third-party position APIs, and no API keys. The inputs are
small and static: a star catalog (HYG v4.1), a daily satellite element set (CelesTrak TLEs),
the observer's latitude/longitude, and the system clock.

That constraint is what makes the project interesting. Instead of calling a service that
returns "where is Jupiter," the app has to *be* that service: implement the orbital mechanics,
the coordinate transforms, and the atmospheric corrections itself. It also keeps the app free
to run forever (static hosting, $0) and fully functional offline.

Everything below follows from that one choice.

---

## 2. One coordinate pipeline for everything

A catalog entry is just a Right Ascension / Declination pair, a fixed direction on the
celestial sphere. Getting it onto the screen for *your* location at *this* moment is a fixed
chain of transforms, and every body (stars, planets, Moon, Sun, deep-sky objects) flows
through the same path:

```
catalog RA/Dec (J2000)
  1. precess to today's date     Earth's axis wobbles ~50 arcsec/year (Meeus ch. 21)
  2. Local Sidereal Time         where the sky is "rotated to" now, from longitude + clock
  3. equatorial -> horizontal    spherical trig: the object's altitude + azimuth for you
  4. atmospheric refraction      air bends light near the horizon (Bennett's formula)
  5. project to pixels           dome or gnomonic projection
```

The payoff of forcing everything through one pipeline is that positions are consistently
*apparent* and *topocentric*: what you would actually see standing where you are, not an
idealized geocentric model. The Sun and planets come from Meeus and Keplerian theory; the Moon
additionally gets a topocentric parallax correction, because it is close enough that *where on
Earth you stand* shifts it by up to about a degree.

The pipeline is split into small, pure functions (`astronomy/coordinates.ts`,
`sidereal.ts`, `precession.ts`, `refraction.ts`, `parallax.ts`), which is what makes each step
independently testable (see section 7).

---

## 3. Why satellites need different math

This is the most interesting "gotcha" in the project, and the one worth talking through.

The star pipeline in section 2 quietly assumes objects are **infinitely far away**: a star is
so distant that standing in New York vs. London points you in essentially the same direction.
That assumption is what lets us treat a star as a pure RA/Dec direction.

Satellites break it completely. The ISS orbits at roughly 400 km, against an Earth radius of
about 6,371 km. So *where on Earth you stand* changes the look direction to a satellite by
**tens of degrees**. Running a satellite's geocentric RA/Dec through the same
`equatorialToHorizontal` transform puts it in the wrong part of the sky entirely.

The fix is a different pipeline:

```
TLE  --SGP4-->  ECI position (Earth-centered inertial)
     --eciToEcf-->  ECF position (Earth-centered, Earth-fixed; rotates with the planet)
     --ecfToLookAngles(your lat/lon)-->  true topocentric azimuth + elevation
```

Gallerium runs SGP4 propagation (via `satellite.js`) to get the satellite's Earth-centered
position, then converts to your actual look angles. RA/Dec is kept only for reference.

There is a second subtlety: a satellite is only **naked-eye visible** when it is sunlit (not in
Earth's shadow) *and* your sky is dark. A satellite passing overhead at noon, or one in Earth's
shadow at night, is invisible. So before drawing one, the app runs a cylindrical-shadow test
(`isSatelliteSunlit`) and checks that the Sun is below the horizon for the observer. The result
is that the satellites shown are the ones you could genuinely spot.

---

## 4. Two projections behind one renderer

The app has two views that look very different but share almost all their code:

- **Map (dome)** view: a top-down planetarium dome. Uses an azimuthal projection where the
  zenith is the center and the horizon is the rim.
- **AR (point-at-the-sky)** view: uses the phone's orientation sensors and a **gnomonic
  (pinhole-camera) projection** centered on wherever the phone is aimed.

A naive AR projection (just plotting the difference in azimuth and altitude) looks wrong near
the zenith, because azimuth lines converge there. The gnomonic projection is the correct camera
model: an object N degrees off-axis lands at `tan(N) * focal` pixels from center, so spacing is
right everywhere.

The two views are unified by making projection a **function type**, not a branch scattered
through the renderer:

```ts
type AltAzProjector = (alt, az) => [x, y] | null;   // null = off-screen / below horizon
```

`draw()` builds the right projector once per frame; every body renderer takes an
`AltAzProjector` and never touches astronomy or view math. The render layer stays a pure
"given positions, draw pixels" layer, and the same `renderStars`, `renderMoon`, etc. serve both
views unchanged.

The AR projector is also the render hot path (it re-projects every visible star on every
orientation change), so it has a hand-optimized variant, `makePointedProjector`, that hoists
the per-frame constants out of the per-star loop, drops a per-star `acos`, and adds a cheap
broad-phase cull. It is held to a parity test against the readable reference implementation.

---

## 5. A render loop that respects the battery

This is a mobile, outdoor, long-session app. Burning the GPU at 60 fps while you stare at a
static sky would be the wrong default. So the loop is built around two ideas:

**Throttled compute.** Projecting ~9,000 stars depends only on (time, location), not on pan,
zoom, or orientation. So bodies recompute on a 1 s cadence and the faster-moving satellites at
250 ms. Each computation is still exact for its timestamp.

**Draw-on-change.** A frame is only drawn when something actually changed: a recompute tick, a
zoom/pan, an orientation move past a small threshold, a selection, or a resize. An idle map
sits near 1 fps instead of 60.

The decision logic is extracted into a **pure state machine** (`engine/scheduler.ts`): given
the current time and a few flags, `tick()` returns "recompute bodies? recompute satellites?
redraw?" The render loop just performs the side effects it asks for. Pulling this out of the
loop made it unit-testable, and that paid off immediately:

> A test for the scheduler's first-sample case caught a real bug. The AR redraw gate compared
> the device's new orientation against a stored previous value initialized to `NaN`. Because
> `Math.abs(x - NaN) > threshold` is always false, the gate never fired, so AR would not redraw
> on the very first phone movement. It was invisible in the math tests and only the scheduler
> test surfaced it.

Animation lives *inside* this model rather than fighting it. The one-time cinematic load reveal
and the brief tap/lock feedback rings are time-bounded (the loop draws every frame only while
one is running, then stops). The "living sky" twinkle runs a low-rate ambient redraw only while
it is dark and you have recently interacted, then settles back to fully static. Nothing
animates forever.

---

## 6. Moving the hot path off the main thread

Section 5 throttles *how often* the body compute runs. This section is about *where* it runs.

Projecting ~9,000 stars (the equatorial-to-horizontal trig plus refraction, every second) is
the single heaviest tick in the app. On a fast machine it is a couple of milliseconds; on a
low-end phone it can be a 10 to 20 ms stall, which is enough to drop a frame, especially during
an animation or in AR where redraws are frequent.

So that work runs in a **Web Worker** (`engine/compute.worker.ts`):

```
main thread                         worker thread
-----------                         -------------
setCatalog() -> postMessage ----->  store precessed catalog (once per load)
each 1s tick -> postMessage ----->  run computeBodies(...)  (the heavy trig)
                          <-----    postMessage(SkyBodies)
onmessage: engine.bodies = result; redraw next frame
```

A few decisions worth calling out:

- **The pure function is shared, not duplicated.** The worker calls the exact same
  `computeBodies` that the main thread does. It is the single, unit-tested source of truth; the
  worker is thin glue. The catalog is sent once (after precession), so each tick only sends the
  observer and timestamp.
- **Graceful fallback.** If `Worker` is unavailable, or one fails to start, `requestBodies`
  transparently falls back to computing synchronously on the main thread. The app behaves
  identically; it just loses the offload. The worker chunk is also precached by the service
  worker, so it works offline.
- **An honest tradeoff.** The worker returns the full result via structured clone, so the main
  thread pays a small deserialize cost. The heavy trig is still off the render thread, which is
  the win. A clear next optimization is to transfer the star alt/az as a zero-copy
  `Float32Array` (a transferable `ArrayBuffer`) and update positions in place, which would
  remove the deserialize entirely.

Satellites stay on the main thread: the set is small and the cadence is fast, so the offload
would not pay for itself.

---

## 7. How I know the math is right

For a "computed from scratch" project, the obvious question in an interview is: *how do you know
the positions are correct, and not just plausible-looking?* Two independent strategies:

**Exact geometric invariants.** Anything that is true regardless of the astronomy model is
asserted exactly: the zenith maps to the screen center, the cardinal directions resolve
correctly, objects below the horizon are culled, and the gnomonic projection maps `fov/2` to
the screen edge with `offset = tan(angle) * focal`. These tests do not care about ephemeris
accuracy; they pin the geometry.

**Ground truth where it is verifiable.** The accuracy suite leans on facts that are independently
checkable rather than numbers I might transcribe wrong:

- The Sun's declination is **0 at the equinoxes and ±obliquity at the solstices, by
  definition**. Feeding the 2025 equinox/solstice instants to the solar model and checking it
  lands on 0 / ±23.44 degrees is real ground truth.
- The Sun lies on the ecliptic (its ecliptic latitude is ~0 all year). The Moon never strays
  beyond its orbital inclination (~5.3 degrees) from the ecliptic, and stays within physical
  perigee/apogee distance bounds. These are invariants the model must satisfy.
- Planet positions are cross-checked against JPL Horizons with documented, honest tolerances.

The suite is also honest about precision rather than overclaiming: the Sun is good to about
0.01 degrees, the Moon to about 2 degrees, planets to about 1 degree near J2000 (drifting for
dates far from epoch). Nutation and aberration are deliberately omitted because each is below
0.01 degrees, under the visible threshold for a visual app.

---

## 8. Architecture and testing

**Strict layer separation.** The codebase is split into layers that never reach across each
other:

- `astronomy/` is pure math with no DOM and no rendering.
- `render/` takes computed positions and draws pixels, with no astronomy math.
- `engine/` holds state and composes the math, still DOM-free.
- `components/` is the only layer that touches the DOM and device APIs.

This is what makes the project testable. The math and the decision logic are pure functions, so
they run in plain Node with no browser. The DOM/canvas glue is kept deliberately thin so there
is little untested surface. Tests are co-located with the code they cover (`foo.ts` next to
`foo.test.ts`), which is the Vitest/TypeScript convention and keeps a test moving with its
module.

The orchestration was originally a single large `main.ts`. It was refactored into a tested
`engine/` (a `SkyEngine` that composes pure `compute` / `search` / `highlights` / `scheduler` /
`status` modules) behind a thin coordinator, which is how the render-loop scheduler and the
compute pipeline became unit-testable in the first place.

CI runs `npm ci`, the test suite, and the production build on every push and pull request. A
green push to `main` auto-deploys to GitHub Pages, so the live site always matches the latest
passing build.

---

## 9. Things I chose not to do

Good engineering is partly knowing where to stop. A few deliberate non-decisions, each of which
is a small judgment-call story:

- **No comets or asteroids from memorized elements.** Bright asteroids are computable with the
  existing Keplerian engine, but only with *verified* epoch elements that cannot be
  cross-checked here without trustworthy ground truth. Shipping positions I cannot verify would
  contradict the whole "validated, not just plausible" point of section 7, so they are deferred
  until a verified elements file is bundled. Comets additionally need live element updates and
  have unpredictable brightness.
- **`satellite.js` is pinned at 4.1.4.** Newer versions ship a WASM/pthread build that breaks
  the bundler. The pin is documented so it is a decision, not an accident.
- **Nutation and aberration are omitted** (section 7): below the visible threshold, not worth
  the complexity for a visual app.
- **No continuous animation by default** (section 5): the battery model comes first; motion is
  always bounded or settles to static.

---

For the implementation details behind any of this, the architecture rules and a full test index
live in [CLAUDE.md](CLAUDE.md).
