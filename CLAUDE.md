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
- **Deployment**: GitHub Pages via GitHub Actions (auto-deploy on push to `main`)

---

## Project Structure

```
src/
├── astronomy/        # Pure math. No DOM, no rendering.
│   ├── coordinates.ts    # RA/Dec → Alt/Az transform (equatorialToHorizontal)
│   ├── sidereal.ts       # GMST, LST from system clock
│   ├── planets.ts        # Keplerian orbital mechanics for 7 planets (VSOP87-lite)
│   ├── moon.ts           # Meeus lunar theory + Earth–Moon distance (~2° accuracy)
│   ├── sun.ts            # Meeus low-precision solar position (~0.01°)
│   ├── refraction.ts     # Atmospheric refraction (Bennett): true → apparent altitude
│   ├── precession.ts     # Precess J2000 RA/Dec to date (Meeus ch. 21)
│   ├── parallax.ts       # Topocentric correction (lunar parallax, Meeus ch. 40)
│   ├── riseset.ts        # Rise / transit / set + twilight times
│   ├── passes.ts         # Visible satellite pass prediction (sunlit + observer dark)
│   ├── referenceLines.ts # Static geometry: ecliptic path + Milky Way (galactic) band
│   ├── altitudeTrack.ts  # Body/Sun altitude over a 24h window (info-card sparkline data)
│   └── satellites.ts     # SGP4 propagation + sunlit/shadow test (satellite.js@4.1.4)
├── data/             # Data loading with IndexedDB caching
│   ├── stars.ts          # HYG v4.1 catalog loader + CSV parser (skips Sun row id 0)
│   ├── tles.ts           # CelesTrak TLE fetcher (GROUP=visual)
│   ├── deepSky.ts        # Embedded Messier/Caldwell catalog (J2000, no fetch)
│   ├── meteorShowers.ts  # Embedded major-shower table (solar-longitude peaks + radiants)
│   └── constellations.json # d3-celestial line + name data (RA/Dec, embedded)
├── render/           # Canvas drawing. Takes computed positions, draws them.
│   ├── canvas.ts         # RenderContext, projectors, altAzToXY, makePointedProjector (AR)
│   ├── sky.ts            # Day/night gradient, twilight glow, ground; star-visibility
│   ├── stars.ts          # Star dots with B-V color index + magnitude sizing
│   ├── deepSky.ts        # Deep-sky glyphs per kind (galaxy/cluster/nebula) + labels
│   ├── planets.ts        # Planet dots with glow + labels
│   ├── satellites.ts     # Satellite dots, ISS highlighted
│   ├── moon.ts           # Moon disc with phase terminator + glow
│   ├── sun.ts            # Sun disc + glow (largest, brightest object)
│   ├── constellations.ts # Constellation lines + decluttered names
│   ├── grid.ts           # Equatorial grid + ecliptic polylines
│   ├── milkyway.ts       # Additive soft-blob galactic band
│   └── labels.ts         # Frame-scoped label declutterer (drawLabel)
├── components/       # DOM, device APIs, user interaction
│   ├── InfoPanel.ts      # Tap-to-identify overlay + altitude-tonight sparkline
│   ├── altitudeSparkline.ts # Pure SVG builder for the info-card altitude curve
│   ├── HitDetection.ts   # Click/touch → nearest object
│   ├── Orientation.ts    # DeviceOrientationEvent → azimuth/altitude (iOS webkitCompassHeading)
│   ├── pose.ts           # Pure device(α,β,γ) → alt/az via rotation matrix (tested)
│   ├── PermissionPrompt.ts # iOS orientation permission flow
│   ├── LocationControl.ts  # Manual lat/long entry + GPS re-request (modal)
│   ├── Layers.ts         # Settings toggles (night vision, RA/Dec) + Bortle slider + optic select
│   ├── TimeControl.ts    # Time-travel panel (datetime / ±h ±d / Live)
│   ├── Search.ts         # Object search overlay (→ "guide me there")
│   ├── Highlights.ts     # "Tonight" feed panel
│   ├── Toolbar.ts        # Bottom toolbar + settings sheet (the single control surface)
│   ├── Tour.ts           # Replayable plain-language feature tour (top-right help button)
│   ├── icons.ts          # SVG line-icon set (no emoji)
│   └── Zoom.ts           # Pinch + wheel zoom factor (shared by both views)
├── store/
│   ├── state.ts          # Shared selected object state
│   └── favorites.ts      # Observing list (persisted search ids) + search reordering
├── utils/
│   ├── cache.ts          # IndexedDB get/set/delete + cacheGetEntry (staleness)
│   ├── clock.ts          # Sky time (live or scrubbed) — single source for all positions
│   ├── fetchWithFallback.ts # Mirror fallback + retry + abort timeout (tested)
│   ├── geo.ts            # Geolocation + localStorage persistence
│   ├── bortle.ts         # Bortle light-pollution scale → limiting mag + Milky Way factor
│   ├── shareUrl.ts       # Encode/parse a shareable view (location/time/zoom/target) in a URL
│   ├── coordFormat.ts    # RA (h/m) + Dec (°/′) formatting for the info card
│   ├── optics.ts         # Optic FOV presets + AR true-field ring geometry
│   ├── haptics.ts        # AR-lock haptic hysteresis (pure) + vibrate() wrapper
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

Map uses `altAzToXY` (dome), AR uses a gnomonic projection; both return null below the
horizon / outside the FOV. The AR view is the hot path — it re-projects every above-horizon
star on each orientation change — so it uses `makePointedProjector(centerAlt, centerAz, fov,
rc)`, a factory that hoists the frame-constants (`sin/cos(centerAlt)`, focal, `cos(fov/2)`)
out of the per-object closure, drops the per-star `acos` (compares `cosC ≥ cos(fov/2)`
directly), and broad-phase rejects anything with `|Δalt| > fov/2` before any trig (great-
circle distance ≥ |Δalt|). `altAzToXYPointed` is the same math in single-shot form, kept for
tests/reference; `makePointedProjector` must stay pixel-identical to it (there's a parity
test). Render stays free of astronomy math. Draw order: sky background →
Milky Way → grid+meridian → ecliptic → constellation lines → deep-sky → stars → satellites →
planets → Moon → Sun → constellation names → (AR: HUD | map: selection ring + compass).
Deep-sky markers sit behind the stars; their (few, curated) labels are placed before the
stars so the showpiece objects keep their names. Call
`beginLabels()` once per draw; `drawLabel()` declutters in call order (bright objects win).

**Selection is a tracked lock, not a snapshot.** A tap or a search result stores a stable
`TargetMeta` identity in `currentTarget` (not a frozen position): `metaFromSelection()`
maps a tapped `SelectedObject` to its identity (star id / planet name / deep-sky id / sun /
moon). Each `draw()` re-resolves `state.selected = targetSelection(currentTarget, bodies)`
against the *current* sky, so the selection ring (map) and the AR guide arrow stay on the
object as it moves — whether time advances naturally (compute tick → redraw) or is scrubbed
(invalidate → recompute → redraw). Tapping empty space clears the lock. Satellites are the
exception (`metaFromSelection` → null): they aren't in `SkyBodies` and move too fast, so
they keep the one-shot snapshot.

**Data loading is resilient.** `utils/fetchWithFallback` tries mirrors in order, retries
transient failures, and aborts hung requests via a timeout. Stars: GitHub-raw + jsDelivr;
TLEs: CelesTrak .org + .com. `loadStars(force)`/`loadTLEs(force)` bypass the cache for the
Layers ▸ "Refresh data" button. `getTleMeta()` exposes cache age for the stale-data warning.

**Day/night.** `render/sky.ts` `skyTone(sunAlt)` interpolates sky colors and
`starVisibility(sunAlt)` fades the star field. The "Daylight" toggle (a standalone button)
drives this; when off, the sky is forced to night (`sunAlt = -90`) with full stars. Even
when on, star visibility is floored (0.5) so stars never fully disappear in daylight.

**Light pollution + night vision.** A Bortle class (1–9, `utils/bortle.ts`) is the
real-world light-pollution control: it sets the star `magnitudeLimit` and a Milky Way
visibility multiplier (`bortleLevel(b).milkyWay`, applied to the Milky Way alpha in `draw`),
so the rendered sky matches what you'd actually see from a dark site vs a city. **Night
vision** is a CSS-only mode (`body.night-vision` → a red `mix-blend-mode: multiply` veil,
`#night-veil`): it keeps only the red channel so the screen stops emitting blue/green light
that spoils dark adaptation. Both live in the settings sheet; night vision is reflected onto
the body class by `applyDisplayModes()` (no canvas redraw needed).

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

**Render loop = throttled compute + draw-on-change.** Computing alt/az for ~9k stars is
the expensive part and depends only on (time, observer), not on orientation/zoom/pan. So
`computeBodies` runs on a cadence (1 s; stars/planets/Moon/Sun are slow) and
`computeSatellites` faster (250 ms; ISS moves ~1°/s) — each computation is still exact for
its timestamp, no precision loss. The *decision* logic (when to recompute, when to draw)
is the pure `engine/scheduler.ts` state machine, unit-tested; the `loop()` in main.ts just
performs the side effects it returns. `draw()` runs only when `tick()` reports a redraw: a
compute tick, a zoom/pan change (polled via `getViewVersion()`), an orientation move
(epsilon-gated; first sample always fires), a selection, a view toggle, or a resize. An
idle map view sits near 1 fps instead of 60. To force a recompute (e.g. location change)
call `invalidatePositions()`; to force a redraw call `markDirty()` (both delegate to the
scheduler).

**initCanvas only reallocates on size change.** Assigning `canvas.width/height`
reallocates+clears the backing store, so it's guarded behind a size check; the DPR scale
uses `setTransform` (idempotent), not `scale` (which would compound each frame).

**One control surface.** All controls live in a bottom `Toolbar` (Search · Time · Sky/Map ·
Tonight · Settings) instead of scattered floating chips. Secondary controls (layer toggles,
night vision, daylight, light pollution (Bortle), location, data refresh) live in the **settings sheet** behind the
Settings button. Each control component exposes an `open()` handle (it no longer creates its
own chip); main wires toolbar buttons to them. The one deliberate exception to the toolbar is
a standalone top-right help button (`.help-fab`) that opens the tour — kept separate so a
first-time user finds it immediately rather than hunting in settings. The tour
(`components/Tour.ts`) is a replayable, stepped, plain-language overlay explaining each
button, not gated to first load. Icons come from `components/icons.ts`
(SVG line-icons, `currentColor`) — **no emoji anywhere** in the UI. `#status` sits top-center,
the help button top-right, and `#info-panel` and the panels anchor above the toolbar.

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

**iOS reset gotcha.** Reset-on-`dblclick` is a *mouse* event — iOS Safari (and the
home-screen PWA) never fires it for touch, and a hand-rolled touch double-tap detector also
proved unreliable on real iPhones. So reset on touch is an explicit **Reset button**
(`.reset-fab`, top-left) wired to `resetView()`; it's shown only while the view is
transformed (`isViewTransformed()` in main, toggled in `draw()`). Desktop keeps `dblclick`
too. The tour points users at the button.

**Startup degrades gracefully.** `init()` loads stars and TLEs independently
(`.catch(() => [])`); a failed fetch never aborts startup. Planets, Moon, and the compass
are pure math and must always render, even fully offline with no cached data.

---

## Known Issues

- **AR azimuth needs on-device confirmation**: altitude is matrix-correct (overhead/roll),
  but azimuth still leans on the compass heading and hasn't been validated on real hardware
  across iOS/Android. There is now a **Compass calibration** slider (settings) that applies a
  persisted heading offset in `getOrientation()`, so any constant compass error can be dialed
  out on-device; what remains is confirming the sign/scale are right on a real phone.
- **Planet accuracy degrades far from J2000**: the low-precision orbital elements
  are accurate to ~1° near year 2000, drift for dates far from that epoch.
- **iPhone zoom reset**: double-tap-to-reset relies on `dblclick`, which iOS doesn't fire
  for touch (a touch double-tap detector was tried and didn't work reliably on device).
  Resolved by a dedicated **Reset button** (top-left, shown when zoomed); desktop also keeps
  double-click. See the "iOS reset gotcha" rule.

---

## Roadmap & Backlog

The engine and core experience are built, tested, and live. What's left is **proof,
depth, and reach** — turning a strong app into a memorable, genuinely useful observing
tool. Tiers: **P0** = next up, **P1** = soon, **P2** = later. Check items off (`[x]`) and
fold notable work into "Shipped". Keep this honest — it's the single source of truth.

### Shipped
- **Astronomy engine** — HYG stars; embedded Messier/Caldwell deep-sky catalog; Sun, Moon,
  and 7 planets (incl. Uranus + Neptune) via Meeus + Kepler; SGP4 satellites. Everything is
  *apparent/topocentric*: refraction, precession (stars + deep-sky), lunar parallax, planet
  magnitude + phase, satellite sunlit-visibility gating. Rise/transit/set + twilight + pass
  prediction. Cross-checked vs Stellarium / JPL Horizons.
- **Rendering** — Canvas-2D map dome + gnomonic AR view sharing one body path via two
  projectors. The AR projector is hand-optimized for the hot path (hoisted frame-constants,
  no per-star `acos`, a |Δalt| broad-phase cull) so it stays smooth while the phone moves.
  Day/night sky, constellations + names, Milky Way, ecliptic/grid/meridian, per-kind deep-sky
  glyphs, planet glyphs (Saturn's rings, Jupiter's bands), diffraction spikes, label
  declutter, vignette/glow. Throttled draw-on-change loop.
- **Features** — time travel (scrub any date/time), search + "guide me there" (map centering /
  AR arrow), Tonight highlights feed (incl. active meteor showers, timed by solar longitude;
  ideal-ZHR rate clearly labelled), tap-to-identify info card with rise/set + an
  altitude-tonight sparkline, tap-to-lock selection that tracks the object as time advances or
  is scrubbed, tappable Tonight rows (guide straight to a highlight), an observing list
  (favorites), alt-az↔RA/Dec coordinate display, an AR optic field-of-view ring, AR-lock
  haptics, AR compass calibration (persisted heading offset), shareable view links + PNG
  export, light-pollution (Bortle) control, night-vision (red) mode, pinch/drag zoom + pan.
- **UI / design** — consolidated bottom toolbar + settings sheet; a standalone top-right help
  button opening a replayable, plain-language feature tour; a contextual reset-zoom button
  (shown only while zoomed/panned); SVG line-icon set (no emoji); design tokens + unified
  class-based panel motion; loading overlay.
- **Platform** — offline-first PWA (Workbox service worker for the shell + IndexedDB for
  data) with a full PNG/maskable icon set and a rich web-manifest; resilient data loading
  (mirror fallback / retry / refresh / staleness warning); device-pose model; geolocation +
  manual location.
- **Engineering** — TDD across astronomy, geometry, data, and the orchestration engine
  (266 tests), including a ground-truth accuracy suite (equinox/solstice Sun + ecliptic /
  lunar-orbit invariants + JPL planet cross-checks) and the cache-staleness logic; `main.ts`
  refactored into a tested `engine/` (SkyEngine + pure compute/search/highlights/scheduler/
  status) behind a thin DOM coordinator; GitHub Actions CI that gates on test + build and
  auto-deploys `main` to GitHub Pages.
- **Docs** — detailed README (architecture, how-it-works, accuracy, data sources) + MIT
  license. (Demo media / screenshots pending real-device captures.)

### A. Proof & packaging (P0)
- [ ] **Demo media** *(user-owned)* — screen-capture GIF/video in the README, manifest
  `screenshots`, and a Lighthouse pass.
- [ ] **Test coverage gaps** — the cache *staleness* logic is pure + tested (`isExpired`), but
  full IndexedDB integration would need a `fake-indexeddb` dev-dep (install was blocked), and
  the DOM-bound parts of `main.ts` (draw, tap → hit-test) remain untested (no jsdom env).
- [ ] **On-device confirmations** — verify on a real iPhone: AR azimuth lines up (tune via the
  compass-calibration slider) and the reset-zoom button works in Safari + the home-screen PWA.

### B. Content depth (P1/P2)
- [ ] **Comets / bright asteroids; constellation figure art** — *deliberately deferred for
  accuracy.* Comets need live orbital elements (they change; brightness is unpredictable);
  bright asteroids are computable with the planet engine but need *verified* epoch elements
  that can't be reproduced/cross-checked here without ground truth, so any test would be
  circular. Figure art is an illustration asset, not code. Won't ship unverifiable astronomy.
  (If you bundle a verified small-body elements file, the propagation + a real ground-truth
  test become straightforward.)

### C. Reach & polish (P2)
- [ ] Accessibility (keyboard nav, ARIA labels, color-blind-safe palette, larger-text mode)
  + i18n.
- [ ] Real-device performance profiling; layered canvases (static stars @ ~1 fps + dynamic
  satellite layer) if the sat-cadence redraw bites; smaller first load (pre-trimmed
  mag ≤ 6.5 star JSON / progressive).
- [ ] Visual leftovers: Moon earthshine/libration, smooth map↔sky crossfade. (Star twinkle
  deliberately deferred — continuous redraw would break the battery model.)

---

## Testing Approach

TDD with Vitest (266 tests, 39 files). **Unit tests are co-located** with the code they
cover (`src/**/*.test.ts`, declared once in `vite.config.ts`) — the Vitest/TS best practice:
a test sits next to its module, moves with it, and imports it relatively. This is deliberate;
don't relocate tests into a separate tree. The whole suite, by layer:

| Layer | Test files (`*.test.ts`) — what each covers |
|---|---|
| `astronomy/` | `coordinates` (eq→horizontal) · `sun` · `moon` · `planets` (7, Kepler + mags) · `precession` · `parallax` · `refraction` · `riseset` (+twilight) · `passes` · `satellites` (SGP4 + sunlit) · `referenceLines` · `altitudeTrack` (24h altitude/Sun tracks) · **`accuracy`** (cross-cutting ground-truth suite) |
| `engine/` | `compute` · `search` · `highlights` (Tonight feed + meteor-shower text) · `meteorShowers` (λ☉ peak timing + radiant altitude) · `scheduler` (cadence + draw-on-change) · `status` · `SkyEngine` (load→locate→compute lifecycle) |
| `render/` | `canvas` (both projections + optimized AR projector parity) |
| `components/` | `HitDetection` (`pickObject`) · `pose` · `Orientation` (heading calibration) · `Tour` (content + nav) · `Layers` (night-vision + Bortle state) · `altitudeSparkline` (SVG builder + altToY) |
| `data/` | `stars` (HYG parser) · `deepSky` (catalog integrity) · `meteorShowers` (table integrity) |
| `store/` | `favorites` (toggle/order pure helpers + persisted store) |
| `utils/` | `cache` (staleness) · `clock` (sky time) · `bortle` (light-pollution) · `shareUrl` (view-link) · `coordFormat` (RA/Dec) · `optics` (FOV ring) · `haptics` (lock hysteresis) · `fetchWithFallback` (mirror/retry) |

Ground truth for astronomy is cross-checked against Stellarium Web or JPL Horizons. Astronomy
position tests use wide tolerances (±5°) — this is a visual app, not a navigation system
("places X in the correct region of the sky"). Pure geometry is tested exactly: model-agnostic
invariants (zenith→center, cardinal directions, culling, up/down & east/west signs, azimuth
wrap) plus gnomonic-specific properties (fov/2 → screen edge, offset = tan(angle)·focal,
behind-camera rejection).

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

Deploy to GitHub Pages: **automatic** — pushing to `main` runs CI (`.github/workflows/ci.yml`),
and if tests + build pass, the `deploy` job publishes `dist/` to Pages via the official
`actions/deploy-pages` flow. No manual step. To redeploy without a code change, run the
workflow by hand from the repo's **Actions** tab (it has a `workflow_dispatch` trigger).
Pages **Source** must be set to "GitHub Actions" in repo Settings.

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

Note: HYG row id 0 is the Sun ("Sol") at RA/Dec 0,0 (the vernal-equinox point on the
ecliptic). `parseCSV` skips it on fresh fetches, and `precessCatalog` (engine/compute.ts)
filters `id === 0` again at use time so a catalog **cached before that skip existed**
can't render a second sun on the ecliptic. The real Sun is computed in `astronomy/sun.ts`.
(Same belt-and-suspenders pattern as the quoted-empty `""` name sanitization.)

---

## Asking Claude for Help

This project was built incrementally with TDD. When asking for analysis or changes:

- **Be specific about the layer**: "in the astronomy layer" vs "in the render layer"
- **Reference the coordinate pipeline** when asking about position bugs
- **Check tests first** before changing any astronomy math — the tests are ground truth
- **Don't change satellite.js version** without understanding the WASM build issue
- **Stellarium Web** (stellarium-web.org) is the fastest way to get ground truth positions for a specific date/time to validate astronomy math changes