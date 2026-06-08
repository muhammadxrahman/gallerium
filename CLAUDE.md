# CLAUDE.md — Gallerium

A mobile-first sky awareness web app. Renders stars, planets, Moon, and satellites
in real time from the user's location. No backend, no API keys, no hosting costs.

---

## Stack

- **Language**: TypeScript (strict)
- **Bundler**: Vite
- **Tests**: Vitest
- **Rendering**: Canvas 2D (no Three.js, no WebGL)
- **Offline/PWA**: vite-plugin-pwa (Workbox) — generates the service worker at build
- **Deployment**: GitHub Pages via gh-pages

---

## Project Structure

```
src/
├── astronomy/        # Pure math. No DOM, no rendering.
│   ├── coordinates.ts    # RA/Dec → Alt/Az transform (equatorialToHorizontal)
│   ├── sidereal.ts       # GMST, LST from system clock
│   ├── planets.ts        # Keplerian orbital mechanics for 5 planets (VSOP87-lite)
│   ├── moon.ts           # Meeus lunar theory (~2° accuracy)
│   ├── sun.ts            # Meeus low-precision solar position (~0.01°)
│   └── satellites.ts     # SGP4 propagation via satellite.js@4.1.4
├── data/             # Data loading with IndexedDB caching
│   ├── stars.ts          # HYG v4.1 catalog loader + CSV parser
│   └── tles.ts           # CelesTrak TLE fetcher (GROUP=visual)
├── render/           # Canvas drawing. Takes computed positions, draws them.
│   ├── canvas.ts         # RenderContext, altAzToXY, altAzToXYPointed, renderCompass
│   ├── stars.ts          # Star dots with B-V color index + magnitude sizing
│   ├── planets.ts        # Planet dots with glow + labels
│   ├── satellites.ts     # Satellite dots, ISS highlighted
│   ├── moon.ts           # Moon disc with phase terminator + glow
│   └── sun.ts            # Sun disc + glow (largest, brightest object)
├── components/       # DOM, device APIs, user interaction
│   ├── InfoPanel.ts      # Tap-to-identify overlay (stars, planets, Moon, satellites)
│   ├── HitDetection.ts   # Click/touch → nearest object
│   ├── Orientation.ts    # DeviceOrientationEvent → azimuth/altitude (iOS webkitCompassHeading)
│   ├── PermissionPrompt.ts # iOS orientation permission flow
│   ├── LocationControl.ts  # Manual lat/long entry + GPS re-request
│   └── Zoom.ts           # Pinch + wheel zoom factor (shared by both views)
├── store/
│   └── state.ts          # Shared selected object state
├── utils/
│   ├── cache.ts          # IndexedDB get/set/delete
│   ├── geo.ts            # Geolocation + localStorage persistence
│   └── math.ts           # toRad, toDeg, normalizeAngle, clamp, lerp
└── main.ts           # Orchestration: load → locate → render loop
```

---

## Architecture Rules

**Strict layer separation.** The three layers never reach across:
- `astronomy/` — pure functions, no imports from render/ or components/
- `render/` — takes computed data, draws it, no astronomy math
- `components/` — orchestrates the other two, handles DOM/device APIs

**Coordinate pipeline.** Everything flows through one path:
1. Raw catalog data (RA/Dec in degrees)
2. `getLST()` from sidereal.ts gives Local Sidereal Time
3. `equatorialToHorizontal()` converts to Alt/Az for the observer
4. `altAzToXY()` or `altAzToXYPointed()` converts to canvas pixels

**Satellites bypass step 3.** They are near-field (LEO ~400 km vs Earth's ~6371 km
radius), so geocentric RA/Dec run through `equatorialToHorizontal` is off by tens of
degrees. Instead `getVisibleSatellites(tles, date, observer)` computes true topocentric
Az/Alt via satellite.js `eciToEcf` + `ecfToLookAngles`; RA/Dec is kept only for reference.

**HYG catalog note.** The CSV has quoted headers (`"ra"` not `ra`).
The parser strips quotes: `headers.split(",").map(h => h.replace(/"/g, "").trim())`.
RA is stored in hours in HYG — multiply by 15 to get degrees.

**satellite.js version is pinned at 4.1.4.** Do not upgrade.
Newer versions ship a WASM/pthread build that breaks Vite's bundler.

**Cache is IndexedDB via cache.ts.** Stars are cached for 1 week, TLEs for 24 hours.
Cache failures are caught and logged as warnings — they never block data loading.

**Offline is two layers.** The service worker (vite-plugin-pwa/Workbox) precaches the
app *shell* (JS/CSS/HTML/icon) so the page loads with no network. IndexedDB caches the
*data* (stars/TLEs). They are independent — never route catalog/TLE fetches through the SW.

**SW updates: registered manually in main.ts** (`injectRegister: false`) with
`registerType: 'autoUpdate'`. We poll `registration.update()` on `visibilitychange`/
`focus` and hourly. This is required for iOS home-screen (standalone) apps: they stay
resident and rarely navigate, so the default register-only flow never sees new deploys.
On finding a new SW, autoUpdate activates it and reloads the page.

**Render loop = throttled compute + draw-on-change** (main.ts). Computing alt/az for
~9k stars is the expensive part and depends only on (time, observer), not on
orientation/zoom/pan. So `computeBodies` runs on a cadence (1 s; stars/planets/Moon/Sun
are slow) and `computeSatellites` faster (250 ms; ISS moves ~1°/s) — each computation is
still exact for its timestamp, no precision loss. `draw()` runs only when a `needsRedraw`
flag is set: a compute tick, a zoom/pan change (polled via `getViewVersion()`), an
orientation move (epsilon-gated), a selection, a view toggle, or a resize. An idle map
view sits near 1 fps instead of 60. To force a recompute (e.g. location change) call
`invalidatePositions()`; to force a redraw call `markDirty()`.

**initCanvas only reallocates on size change.** Assigning `canvas.width/height`
reallocates+clears the backing store, so it's guarded behind a size check; the DPR scale
uses `setTransform` (idempotent), not `scale` (which would compound each frame).

**Zoom + pan** live in components/Zoom.ts (wheel, mouse-drag, pinch, 1-finger drag;
double-click/tap resets). Zoom is anchored at the cursor/pinch point so any region can be
brought into focus. Map view applies both via `applyView(rc)` in main.ts (`rc.radius *=
zoom; rc.center += pan`); sky view is orientation-driven and uses only the zoom factor
(`FOV = 90 / zoom`). Hit detection MUST call the same `applyView(rc)` so taps line up, and
skip selection when `recentlyInteracted()` (the pointer-up that ends a drag isn't a tap).

**Startup degrades gracefully.** `init()` loads stars and TLEs independently
(`.catch(() => [])`); a failed fetch never aborts startup. Planets, Moon, and the compass
are pure math and must always render, even fully offline with no cached data.

---

## Known Issues

- **Orientation jitter on mode switch**: switching to sky view causes a visible jump
  because the first frame uses a stale orientation value before the device settles.
- **Planet accuracy degrades far from J2000**: the low-precision orbital elements
  are accurate to ~1° near year 2000, drift for dates far from that epoch.
- **Moon position is geocentric**: no lunar parallax correction, so it can be up to
  ~1° off from the observer's true perspective. Acceptable for a visual app.

---

## Roadmap & Backlog

A running, prioritized backlog toward a standout astronomy app: **beautiful · accurate ·
real-world useful**. Tiers: **P0** = next up, **P1** = soon, **P2** = later. Check items
off (`[x]`) and move notable ones to "Shipped" as they land. Keep this list honest — it is
the single source of truth for what's left.

### Shipped
- [x] Real Sun (computed, not the bogus HYG "Sol" row) — disc, glow, identify
- [x] Performance: throttled compute + draw-on-change loop; no per-frame canvas realloc
- [x] Zoom + pan (wheel/drag/pinch), cursor-anchored
- [x] Topocentric satellites (true look angles, not geocentric — was ~70° off)
- [x] Kepler solver unit fix (planets were up to ~8° off)
- [x] Moon phase name + correct terminator side (waxing/waning)
- [x] Offline PWA shell + IndexedDB data + iOS update polling
- [x] Manual location entry / GPS re-request; graceful offline degradation
- [x] iOS compass heading via `webkitCompassHeading`
- [x] Tests for the hot paths: projection (`altAzToXY`/`altAzToXYPointed`), hit detection
  (`pickObject`), TLE parser edge cases — found no regressions

### Beautiful (visual fidelity & UX)
- [ ] **P0** Day/night sky gradient + twilight bands driven by Sun altitude (sky must not
  be black at noon); horizon glow. Also answers "is it dark enough to observe yet?"
- [ ] **P0** Constellation lines + names (free Stellarium / d3-celestial dataset) — the
  single biggest legibility + "feels like a real sky" win.
- [ ] **P1** Horizon + ground reference; toggleable meridian / ecliptic / equatorial grid.
- [ ] **P1** Label decluttering (collision avoidance — labels currently overlap).
- [ ] **P1** On-canvas selection highlight (today only the DOM info panel reacts).
- [ ] **P1** Milky Way band.
- [ ] **P2** Richer star/planet rendering: magnitude→size+alpha curve, subtle glow/twinkle,
  antialiasing; planet disks + Saturn rings; Moon earthshine/libration.
- [ ] **P2** First-run onboarding, real loading spinner (replace status string), smooth
  map↔sky transition, polished chrome/theming.
- [ ] **P2** Light-pollution / limiting-magnitude (Bortle) slider.

### Accurate (physical correctness)
- [ ] **P0** Proper AR pose model: use full device orientation (alpha/beta/gamma + screen
  orientation) → view direction. Current `90 - |beta|` can't point overhead/behind and
  ignores roll. Fixes both accuracy and the mode-switch jitter. (See Known Issues.)
- [ ] **P1** Atmospheric refraction near the horizon (~0.5° lift at alt 0) for realistic
  rise/set and horizon placement.
- [ ] **P1** Planet apparent magnitudes (currently placeholder `0`) → correct brightness +
  size; planet phase and angular size.
- [ ] **P1** Satellite *visibility*, not just position: only flag sats that are sunlit while
  the observer is in darkness (Sun is now available).
- [ ] **P2** Lunar topocentric parallax (~1°); precession of J2000 star coords to date;
  nutation/aberration (sub-arcmin).
- [ ] **P2** Hit detection in sky view (currently map-view only).

### Real-world applicable (astronomy utility)
- [ ] **P0** Time control / "time travel": scrub to tonight or any date/time. Everything is
  already `Date`-parameterized, so this is mostly UI — turns "now" into a planning tool.
- [ ] **P0** Search + "guide me there": find an object, then pan/zoom (map) or an AR arrow
  (sky) points you to it.
- [ ] **P1** Rise/set/transit + twilight times (civil/nautical/astronomical) for
  Sun/Moon/planets.
- [ ] **P1** ISS & satellite pass predictions ("visible 9:42pm, rising NW, mag −3").
- [ ] **P1** Tonight's highlights feed: conjunctions, Moon phase, bright-planet visibility,
  meteor showers.
- [ ] **P2** Deep-sky objects (Messier/Caldwell) with positions + info.
- [ ] **P2** Observing list / favorites; shareable location+time+view URL.
- [ ] **P2** Settings: coordinate display (alt/az vs RA/dec), magnitude limit, units, i18n.

### Foundation (robustness, code health, ops)
- [x] **P0** Test the untested hot paths: projection (`altAzToXY` / `altAzToXYPointed`),
  hit detection (`pickObject`), TLE parser. Done — projection tests assert only
  model-agnostic invariants so they survive the gnomonic upgrade below.
- [ ] **P1** Upgrade `altAzToXYPointed` to a true gnomonic (pinhole-camera) projection.
  Today it places objects by raw (Δaz, Δalt) which over-spreads them near the zenith
  (azimuth isn't scaled by cos(alt)). Correct but currently an approximation; fold into
  the AR pose-model work so the camera model is right end-to-end.
- [ ] **P1** Unify render paths: sky view re-implements star/planet/satellite drawing inline
  in `main.ts` instead of reusing `render/*`. Move to one drawable path that takes a
  projection function, so visual changes apply to both views at once.
- [ ] **P1** Data robustness: source mirror/retry, manual "refresh data", TLE-staleness
  indicator, surface fetch errors in the UI.
- [ ] **P1** CI: GitHub Actions running `npm test` + `npm run build` on push.
- [ ] **P2** Layered canvases (static star layer @ ~1 fps + dynamic satellite layer) if
  profiling shows the full-scene redraw at the satellite cadence matters.
- [ ] **P2** Smaller first load: ship a pre-trimmed mag ≤ 6.5 star JSON instead of fetching
  the full HYG CSV; progressive load.
- [ ] **P2** PWA polish: PNG icons (broader install support) + manifest screenshots /
  categories; Lighthouse PWA pass.
- [ ] **P2** Accessibility: colorblind-safe star colors, contrast, larger-text mode, ARIA
  labels on controls.

---

## Testing Approach

TDD with Vitest. Every astronomy module has a test file, plus the render projection
(`render/canvas.test.ts`), hit detection (`components/HitDetection.test.ts`), and the
star/TLE parsers. Ground truth for astronomy is cross-checked against Stellarium Web or
JPL Horizons. Astronomy position tests use wide tolerances (±5°) — this is a visual app,
not a navigation system ("places X in the correct region of the sky"). Pure geometry
(projection, hit-testing) is tested exactly, but only via projection-model-agnostic
invariants (zenith→center, cardinal directions, culling, up/down & east/west signs,
azimuth wrap) so the tests survive a future gnomonic-projection upgrade.

Hit detection's geometry lives in the pure `pickObject(x, y, rc, …)`; `handleClick` is a
thin wrapper that extracts event coords and calls it. Test `pickObject`, not `handleClick`.

Run tests:
```bash
npm test
```

Build:
```bash
npm run build
```

Deploy to GitHub Pages:
```bash
npm run deploy
```

Dev server (HTTPS for iOS orientation API):
```bash
npm run dev
# Use the Network: https://192.168.x.x:5173 URL on mobile
# Accept the self-signed cert warning in Safari
```

---

## Data Sources

| Data | Source | Update frequency |
|---|---|---|
| Stars | HYG v4.1 (GitHub raw) | Cached 1 week |
| Satellites | CelesTrak visual group | Cached 24 hours |
| Planets | Computed (no fetch) | Real-time |
| Moon | Computed (no fetch) | Real-time |
| Sun | Computed (no fetch) | Real-time |

Note: HYG row id 0 is the Sun ("Sol") at RA/Dec 0,0 — `parseCSV` skips it; the real
Sun is computed in `astronomy/sun.ts`.

---

## Asking Claude for Help

This project was built incrementally with TDD. When asking for analysis or changes:

- **Be specific about the layer**: "in the astronomy layer" vs "in the render layer"
- **Reference the coordinate pipeline** when asking about position bugs
- **Check tests first** before changing any astronomy math — the tests are ground truth
- **Don't change satellite.js version** without understanding the WASM build issue
- **Stellarium Web** (stellarium-web.org) is the fastest way to get ground truth positions for a specific date/time to validate astronomy math changes