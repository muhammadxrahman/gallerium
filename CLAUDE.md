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
│   └── satellites.ts     # SGP4 propagation via satellite.js@4.1.4
├── data/             # Data loading with IndexedDB caching
│   ├── stars.ts          # HYG v4.1 catalog loader + CSV parser
│   └── tles.ts           # CelesTrak TLE fetcher (GROUP=visual)
├── render/           # Canvas drawing. Takes computed positions, draws them.
│   ├── canvas.ts         # RenderContext, altAzToXY, altAzToXYPointed, renderCompass
│   ├── stars.ts          # Star dots with B-V color index + magnitude sizing
│   ├── planets.ts        # Planet dots with glow + labels
│   └── satellites.ts     # Satellite dots, ISS highlighted
├── components/       # DOM, device APIs, user interaction
│   ├── InfoPanel.ts      # Tap-to-identify overlay
│   ├── HitDetection.ts   # Click/touch → nearest object
│   ├── Orientation.ts    # DeviceOrientationEvent → azimuth/altitude
│   └── PermissionPrompt.ts # iOS orientation permission flow
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

## What's Not Here Yet

- Constellation lines (NGC constellation line dataset, free)
- The Sun (similar to planet math, needs solar longitude formula)
- Hit detection in sky view mode (currently only works in map view)
- Loading spinner (currently just a status text string)
- Proper HTTPS for production (currently uses self-signed cert for local dev)

---

## Testing Approach

TDD with Vitest. Every astronomy module has a test file.
Ground truth is cross-checked against Stellarium Web or JPL Horizons.
Tests use wide tolerances (±5°) for position checks — this is a visual app,
not a navigation system. Exact wording: "places X in the correct region of the sky."

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

---

## Asking Claude for Help

This project was built incrementally with TDD. When asking for analysis or changes:

- **Be specific about the layer**: "in the astronomy layer" vs "in the render layer"
- **Reference the coordinate pipeline** when asking about position bugs
- **Check tests first** before changing any astronomy math — the tests are ground truth
- **Don't change satellite.js version** without understanding the WASM build issue
- **Stellarium Web** (stellarium-web.org) is the fastest way to get ground truth positions for a specific date/time to validate astronomy math changes