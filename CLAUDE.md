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
│   ├── moon.ts           # Meeus lunar theory + Earth–Moon distance (~2° accuracy)
│   ├── sun.ts            # Meeus low-precision solar position (~0.01°)
│   ├── refraction.ts     # Atmospheric refraction (Bennett): true → apparent altitude
│   ├── precession.ts     # Precess J2000 RA/Dec to date (Meeus ch. 21)
│   ├── parallax.ts       # Topocentric correction (lunar parallax, Meeus ch. 40)
│   ├── riseset.ts        # Rise / transit / set + twilight times
│   ├── passes.ts         # Visible satellite pass prediction (sunlit + observer dark)
│   ├── referenceLines.ts # Static geometry: ecliptic path + Milky Way (galactic) band
│   └── satellites.ts     # SGP4 propagation + sunlit/shadow test (satellite.js@4.1.4)
├── data/             # Data loading with IndexedDB caching
│   ├── stars.ts          # HYG v4.1 catalog loader + CSV parser (skips Sun row id 0)
│   ├── tles.ts           # CelesTrak TLE fetcher (GROUP=visual)
│   └── constellations.json # d3-celestial line + name data (RA/Dec, embedded)
├── render/           # Canvas drawing. Takes computed positions, draws them.
│   ├── canvas.ts         # RenderContext, EqProjector, altAzToXY, altAzToXYPointed
│   ├── sky.ts            # Day/night gradient, twilight glow, ground; star-visibility
│   ├── stars.ts          # Star dots with B-V color index + magnitude sizing
│   ├── planets.ts        # Planet dots with glow + labels
│   ├── satellites.ts     # Satellite dots, ISS highlighted
│   ├── moon.ts           # Moon disc with phase terminator + glow
│   ├── sun.ts            # Sun disc + glow (largest, brightest object)
│   ├── constellations.ts # Constellation lines + decluttered names
│   ├── grid.ts           # Equatorial grid + ecliptic polylines
│   ├── milkyway.ts       # Additive soft-blob galactic band
│   └── labels.ts         # Frame-scoped label declutterer (drawLabel)
├── components/       # DOM, device APIs, user interaction
│   ├── InfoPanel.ts      # Tap-to-identify overlay (stars, planets, Moon, satellites)
│   ├── HitDetection.ts   # Click/touch → nearest object
│   ├── Orientation.ts    # DeviceOrientationEvent → azimuth/altitude (iOS webkitCompassHeading)
│   ├── pose.ts           # Pure device(α,β,γ) → alt/az via rotation matrix (tested)
│   ├── PermissionPrompt.ts # iOS orientation permission flow
│   ├── LocationControl.ts  # Manual lat/long entry + GPS re-request (modal)
│   ├── Layers.ts         # buildLayersControls() → toggles + star-density slider (in settings)
│   ├── TimeControl.ts    # Time-travel panel (datetime / ±h ±d / Live)
│   ├── Search.ts         # Object search overlay (→ "guide me there")
│   ├── Highlights.ts     # "Tonight" feed panel
│   ├── Toolbar.ts        # Bottom toolbar + settings sheet (the single control surface)
│   ├── icons.ts          # SVG line-icon set (no emoji)
│   └── Zoom.ts           # Pinch + wheel zoom factor (shared by both views)
├── store/
│   └── state.ts          # Shared selected object state
├── utils/
│   ├── cache.ts          # IndexedDB get/set/delete + cacheGetEntry (staleness)
│   ├── clock.ts          # Sky time (live or scrubbed) — single source for all positions
│   ├── fetchWithFallback.ts # Mirror fallback + retry + abort timeout (tested)
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

**Sky time.** All positions read `getSkyTime()` (utils/clock.ts), not `new Date()` — the loop
passes it into `computeBodies`/`computeSatellites`. Live by default; the Time control freezes
it for planning. Star precession is fixed at load epoch (negligible drift within a session).

**Apparent position.** `computeBodies` (main.ts) turns geometric into *apparent* positions:
stars are precessed J2000→date once per load (`precessedStars`); the Moon's geocentric
RA/Dec gets a topocentric-parallax correction (it's near-field, ~1°); then every body's
altitude passes through `refractedAltitude` (`toApparentHorizontal`). Satellites are gated by
visibility — only shown when the observer is dark (Sun < −6°) and the satellite is sunlit
(`isSatelliteSunlit`). Nutation/aberration are intentionally omitted (<0.01°).

**One draw path, two projectors.** `draw()` is shared between map and AR; they differ only
in two closures built per frame:
- `EqProjector = (ra,dec) => [x,y] | null` — for RA/Dec overlays (constellations, grid,
  ecliptic, Milky Way). Composes `equatorialToHorizontal` (using the last computed
  `lastLST`, so overlays align with the throttled star positions) with the view projection.
- `AltAzProjector = (alt,az) => [x,y] | null` — for the bodies (stars/planets/sats/Moon/Sun)
  and the meridian. Every body renderer takes one; they no longer call `altAzToXY*` directly.

Map uses `altAzToXY` (dome), AR uses gnomonic `altAzToXYPointed`; both return null below the
horizon / outside the FOV. Render stays free of astronomy math. Draw order: sky background →
Milky Way → grid+meridian → ecliptic → constellation lines → stars → satellites → planets →
Moon → Sun → constellation names → (AR: HUD | map: selection ring + compass). Call
`beginLabels()` once per draw; `drawLabel()` declutters in call order (bright objects win).

**Data loading is resilient.** `utils/fetchWithFallback` tries mirrors in order, retries
transient failures, and aborts hung requests via a timeout. Stars: GitHub-raw + jsDelivr;
TLEs: CelesTrak .org + .com. `loadStars(force)`/`loadTLEs(force)` bypass the cache for the
Layers ▸ "Refresh data" button. `getTleMeta()` exposes cache age for the stale-data warning.

**Day/night.** `render/sky.ts` `skyTone(sunAlt)` interpolates sky colors and
`starVisibility(sunAlt)` fades the star field. The "Daylight" toggle (a standalone button)
drives this; when off, the sky is forced to night (`sunAlt = -90`) with full stars. Even
when on, star visibility is floored (0.5) so stars never fully disappear in daylight.

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

**One control surface.** All controls live in a bottom `Toolbar` (Search · Time · Sky/Map ·
Tonight · Settings) instead of scattered floating chips. Secondary controls (layer toggles,
daylight, star-density, location, data refresh) live in the **settings sheet** behind the
Settings button. Each control component exposes an `open()` handle (it no longer creates its
own chip); main wires toolbar buttons to them. Icons come from `components/icons.ts`
(SVG line-icons, `currentColor`) — **no emoji anywhere** in the UI. `#status` sits top-center,
`#info-panel` and the panels anchor above the toolbar.

**Panel motion is class-based, not display toggles.** Panels/overlays are always in the DOM
and animate via a `.show` class (opacity + translate, shared `--ease`), so they fade+slide
in/out consistently — toggling `display` can't transition. Only one bottom panel (Time /
Tonight) is open at once. Radii come from the `--r-*` tokens.

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

- **AR azimuth needs on-device tuning**: altitude is now matrix-correct (overhead/roll),
  but azimuth still leans on the compass heading and hasn't been validated on real hardware
  across iOS/Android. Expect to tune heading sign/offset once tested on a phone.
- **Planet accuracy degrades far from J2000**: the low-precision orbital elements
  are accurate to ~1° near year 2000, drift for dates far from that epoch.

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
- [x] Visual overhaul: day/night sky gradient + twilight + horizon glow (with a prominent
  Daylight toggle; stars floored so they never vanish), constellation lines + names,
  Milky Way band, ecliptic + equatorial grid (toggleable), label decluttering, on-canvas
  selection ring, richer star rendering, modern frosted-glass UI chrome, SVG favicon
- [x] Sophistication pass: planet glyphs (Saturn rings, Jupiter belts, shaded spheres),
  bright-star diffraction spikes, dome vignette + glassy rim, meridian line, elegant
  loading overlay + canvas fade-in, redesigned info card, star-density (limiting-mag) slider
- [x] Foundation P1: gnomonic AR projection, unified render path (one body path, two
  projectors), resilient data loading (`fetchWithFallback` + mirrors + refresh + staleness), CI
- [x] Accurate section (all): device pose model, atmospheric refraction, planet magnitudes +
  phase, satellite sunlit/visibility, lunar parallax, precession, sky-view hit detection
- [x] Real-world P0/P1: time travel (clock + loop reads `getSkyTime()`), search + guide-me-there
  (map centering / AR arrow), rise/set/twilight in the info card, ISS pass prediction,
  "Tonight" highlights feed; fixed quoted-empty HYG names polluting search
- [x] UI consolidation: scattered chips → one bottom toolbar + settings sheet; replaced all
  emoji with an SVG line-icon set (`icons.ts`); status/info-panel repositioned clear of it
- [x] Design-system pass: radius tokens + shared `--ease`; unified fade+slide entrance for
  every panel/overlay (`.show` classes, not display toggles); dome outer glow + letter-spaced,
  instrument-style compass labels with tick marks

### Beautiful (visual fidelity & UX)
- [x] **P0** Day/night sky gradient + twilight + horizon glow (Sun-altitude driven), with a
  prominent Daylight on/off toggle and a star-brightness floor so stars never fully vanish.
- [x] **P0** Constellation lines + names (d3-celestial dataset → `data/constellations.json`).
- [x] **P1** Ground reference (AR horizon + ground); toggleable ecliptic + equatorial grid.
  (Meridian line still TODO — small add.)
- [x] **P1** Label decluttering via the shared `render/labels.ts` registry.
- [x] **P1** On-canvas selection ring (`renderSelection` in main.ts).
- [x] **P1** Milky Way band (`render/milkyway.ts`, galactic-plane samples).
- [x] Modern frosted-glass UI chrome (`.ui-chip` / `.ui-panel`), SVG favicon.
- [x] **P2** Iconic planet glyphs: shaded spheres with Saturn's rings + Jupiter's belts
  (`drawPlanetBody`, shared map/AR); bright-star diffraction spikes; dome vignette + rim.
- [x] **P2** Elegant loading overlay (wordmark + spinner, canvas fade-in); meridian line.
- [x] **P2** Light-pollution / limiting-magnitude slider (Layers → "Star density").
- [x] **P2** Redesigned info card (per-type accent, frosted, animated in).
- [ ] **P2** Remaining: subtle twinkle (skipped — would force continuous redraw, hurting
  battery), Moon earthshine/libration, smooth map↔sky transition, first-run onboarding tour.

### Accurate (physical correctness)
- [x] **P0** Device pose model (`components/pose.ts`): device→world rotation matrix →
  back-camera direction. Altitude = asin(−cos β·cos γ) now reaches the zenith and accounts
  for roll (the old `90−|β|` could not). Unit-tested. (Azimuth still uses the compass /
  matrix; on-device azimuth tuning is a follow-up since it can't be verified off-hardware.)
- [x] **P1** Atmospheric refraction (`astronomy/refraction.ts`, Bennett) — applied to every
  body's altitude in the pipeline (`toApparentHorizontal`). Tested.
- [x] **P1** Planet apparent magnitudes + illuminated fraction (`MAG_COEFF`, phase angle);
  planets sized by magnitude in render; magnitude + phase shown in the info card. Tested.
- [x] **P1** Satellite visibility: `isSatelliteSunlit` (cylindrical shadow) + observer-dark
  gate (Sun < −6°). Only genuinely visible sunlit passes are shown. Tested.
- [x] **P2** Lunar topocentric parallax (`astronomy/parallax.ts`) using Moon distance from
  `moon.ts`; precession J2000→date (`astronomy/precession.ts`) applied to the catalog once
  per load. Both tested. Nutation/aberration intentionally omitted (<0.01°, far below the
  visual/pixel tolerance — adding them would be false precision).
- [x] **P2** Hit detection works in sky view: `pickObject` takes an `AltAzProjector`, and
  taps use the active view's projector (map dome or AR). Selection ring shows in both.

### Real-world applicable (astronomy utility)
- [x] **P0** Time travel (`utils/clock.ts` + `TimeControl`): the whole render loop reads
  `getSkyTime()`, so scrubbing to any date/time (or stepping ±h/±d) shows the sky then.
- [x] **P0** Search + "guide me there" (`Search` + index in main): find a star/planet/
  constellation → map centers on it (`centerOn`), AR shows a guidance arrow; selection
  stays live as the sky moves. (Fixed: unnamed HYG stars no longer pollute results.)
- [x] **P1** Rise/set/transit + twilight (`astronomy/riseset.ts`, tested) — shown in the
  info card and used by the highlights feed.
- [x] **P1** ISS & satellite pass predictions (`astronomy/passes.ts`, tested) — visible
  (sunlit + dark) passes with peak elevation and rise→set bearing.
- [x] **P1** Tonight's highlights feed (`Highlights`): sunset/astro-dark, Moon phase +
  rise/set, visible planets, close pairings (<5°), next ISS pass.
- [ ] **P2** Deep-sky objects (Messier/Caldwell) with positions + info.
- [ ] **P2** Observing list / favorites; shareable location+time+view URL.
- [ ] **P2** Settings: coordinate display (alt/az vs RA/dec), magnitude limit, units, i18n.

### Foundation (robustness, code health, ops)
- [x] **P0** Test the untested hot paths: projection (`altAzToXY` / `altAzToXYPointed`),
  hit detection (`pickObject`), TLE parser. Done — projection tests assert only
  model-agnostic invariants so they survive the gnomonic upgrade below.
- [x] **P1** `altAzToXYPointed` is now a true gnomonic (pinhole-camera) projection —
  off-axis offset scales as tan(angle)·focal, correct everywhere incl. the zenith. Tested.
- [x] **P1** Unified render paths: every body renderer takes an `AltAzProjector`; `draw()`
  has one shared body path and map vs AR differ only in the two projector closures.
- [x] **P1** Data robustness: `fetchWithFallback` (mirrors + retry + abort timeout, tested),
  HYG via GitHub-raw + jsDelivr mirror, CelesTrak .org/.com fallback, manual "Refresh data"
  (Layers panel), stale-satellite warning (`getTleMeta`), fetch errors surfaced in status.
- [x] **P1** CI: `.github/workflows/ci.yml` runs `npm ci` → `npm run test:run` → `npm run
  build` (typecheck + build) on push/PR.
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

TDD with Vitest (93 tests). Every astronomy module has a test file, plus the render
projection (`render/canvas.test.ts`), hit detection (`components/HitDetection.test.ts`),
the star/TLE parsers, and `utils/fetchWithFallback.test.ts` (mirror fallback/retry, mocked
`fetch`). Ground truth for astronomy is cross-checked against Stellarium Web or JPL
Horizons. Astronomy position tests use wide tolerances (±5°) — this is a visual app, not a
navigation system ("places X in the correct region of the sky"). Pure geometry is tested
exactly: model-agnostic invariants (zenith→center, cardinal directions, culling, up/down &
east/west signs, azimuth wrap) plus gnomonic-specific properties (fov/2 → screen edge,
offset = tan(angle)·focal, behind-camera rejection).

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