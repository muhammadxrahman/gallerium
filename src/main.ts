import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { showPermissionPrompt, } from "./components/PermissionPrompt";
import { getOrientation, isListening } from "./components/Orientation";
import { initInfoPanel, updateInfoPanel } from "./components/InfoPanel";
import { handleClick } from "./components/HitDetection";
import {
  initCanvas,
  renderCompass,
  altAzToXY,
  altAzToXYPointed,
  type RenderContext,
  type EqProjector,
  type AltAzProjector,
} from "./render/canvas";
import { renderStars, type RenderedStar } from "./render/stars";
import { renderPlanets, type RenderedPlanet } from "./render/planets";
import { renderSatellites, type RenderedSatellite } from "./render/satellites";
import { renderMoon, type RenderedMoon } from "./render/moon";
import { renderSun, type RenderedSun } from "./render/sun";
import { renderSkyDome, renderSkyAR, starVisibility } from "./render/sky";
import { renderConstellationLines, renderConstellationNames } from "./render/constellations";
import { renderEquatorialGrid, renderEcliptic, renderMeridian } from "./render/grid";
import { renderMilkyWay } from "./render/milkyway";
import { beginLabels } from "./render/labels";
import { loadStars } from "./data/stars";
import { loadTLEs, getTleMeta } from "./data/tles";
import { equatorialToHorizontal } from "./astronomy/coordinates";
import { getLST } from "./astronomy/sidereal";
import { getAllPlanets } from "./astronomy/planets";
import { getVisibleSatellites } from "./astronomy/satellites";
import { eclipticPath, milkyWayBand } from "./astronomy/referenceLines";
import { refractedAltitude } from "./astronomy/refraction";
import { precessFromJ2000 } from "./astronomy/precession";
import { topocentricCorrection } from "./astronomy/parallax";
import type { Star } from "./data/stars";
import { requestLocation, cachedLocation, saveLocation } from "./utils/geo";
import { initLocationControl } from "./components/LocationControl";
import { initLayersControl, getLayers, setLayer } from "./components/Layers";
import { initZoom, getZoom, getPan, getViewVersion, recentlyInteracted } from "./components/Zoom";
import type { Observer } from "./astronomy/coordinates";
import { getMoonPosition } from "./astronomy/moon";
import { getSunPosition } from "./astronomy/sun";
import { state } from "./store/state";

// Static reference geometry, computed once.
const ECLIPTIC = eclipticPath(2);
const MILKYWAY = milkyWayBand();

// --- State ---
let observer: Observer | null = cachedLocation();
let lastStars: RenderedStar[] = [];
let lastPlanets: RenderedPlanet[] = [];
let lastSatellites: RenderedSatellite[] = [];
let lastMoon: RenderedMoon | null = null;
let lastSun: RenderedSun | null = null;
let lastLST = 0; // Local Sidereal Time (deg) from the last compute — used to project overlays
let isSkyView = false;

const canvas = document.getElementById("sky-canvas") as HTMLCanvasElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const loaderEl = document.getElementById("loader");
const loaderTextEl = document.getElementById("loader-text");
let firstDrawDone = false;

// --- Preloaded data ---
let starsData: Awaited<ReturnType<typeof loadStars>> = [];
let tlesData: Awaited<ReturnType<typeof loadTLEs>> = [];
// Catalog precessed from J2000 to the current epoch (done once per load — precession
// is ~50"/yr, so it's static within a session).
let precessedStars: Star[] = [];

function applyPrecession(now: Date): void {
  precessedStars = starsData.map((s) => {
    const { ra, dec } = precessFromJ2000(s.ra, s.dec, now);
    return { ...s, ra, dec };
  });
}

function setStatus(msg: string) {
  statusEl.textContent = msg;
  // Mirror progress into the loading overlay while it's still up.
  if (loaderTextEl && !firstDrawDone && msg) loaderTextEl.textContent = msg;
}

// Reveal the sky and dismiss the loader once the first frame is painted.
function revealOnce(): void {
  if (firstDrawDone) return;
  firstDrawDone = true;
  canvas.classList.add("ready");
  loaderEl?.classList.add("hidden");
}

// Apply the user's zoom + pan to the map-view dome. Must be applied identically
// when rendering and when hit-testing so taps line up with what's drawn. Sky view
// is orientation-driven and uses only the zoom factor (FOV), so pan is not applied.
function applyView(rc: RenderContext): void {
  const { x, y } = getPan();
  rc.radius *= getZoom();
  rc.centerX += x;
  rc.centerY += y;
}

// Register the service worker and keep it fresh. With registerType "autoUpdate",
// finding a new SW activates it and reloads the page automatically. The catch is
// that the browser only *checks* for a new SW on navigation — and a home-screen
// (standalone) iOS app stays resident and rarely navigates, so it would keep
// serving the old cached build forever. Polling for updates when the app is
// brought to the foreground (and hourly) fixes that.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") registration.update();
    };
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("focus", checkForUpdate);
    setInterval(checkForUpdate, 60 * 60 * 1000); // hourly safety net
  },
});

// AR heads-up overlay: aiming crosshair + compass heading readout.
function renderArHud(rc: RenderContext): void {
  rc.ctx.strokeStyle = "rgba(255,255,255,0.3)";
  rc.ctx.lineWidth = 1;
  rc.ctx.beginPath();
  rc.ctx.moveTo(rc.centerX - 15, rc.centerY);
  rc.ctx.lineTo(rc.centerX + 15, rc.centerY);
  rc.ctx.moveTo(rc.centerX, rc.centerY - 15);
  rc.ctx.lineTo(rc.centerX, rc.centerY + 15);
  rc.ctx.stroke();

  const { azimuth, altitude } = getOrientation();
  rc.ctx.fillStyle = "rgba(255,255,255,0.6)";
  rc.ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
  rc.ctx.textAlign = "center";
  rc.ctx.fillText(
    `Az ${azimuth.toFixed(0)}° · Alt ${altitude.toFixed(0)}°`,
    rc.centerX,
    rc.height - 20
  );
  rc.ctx.textAlign = "left";
}

// Build a coordinate projector for the active view: RA/Dec → screen pixels (or
// null if it should not be drawn). Composes equatorialToHorizontal with the
// view's projection, keeping render modules free of astronomy.
function makeMapProjector(rc: RenderContext): EqProjector {
  return (ra, dec) => {
    const { az, alt } = equatorialToHorizontal({ ra, dec }, observer!, lastLST);
    return alt < 0 ? null : altAzToXY(alt, az, rc);
  };
}

function makeArProjector(
  rc: RenderContext,
  centerAlt: number,
  centerAz: number,
  fov: number
): EqProjector {
  return (ra, dec) => {
    const { az, alt } = equatorialToHorizontal({ ra, dec }, observer!, lastLST);
    if (alt < -0.5) return null; // below the horizon → hidden by the ground
    return altAzToXYPointed(alt, az, centerAlt, centerAz, fov, rc);
  };
}

// The body projector (alt/az → pixels) for the CURRENTLY active view, used by hit
// detection so taps line up with what's drawn — including in AR (sky view). For the
// map it applies zoom/pan to rc; for AR it uses the live orientation + FOV.
function bodyProjectorForView(rc: RenderContext): AltAzProjector {
  if (isSkyView && isListening()) {
    const fov = 90 / getZoom();
    const { azimuth, altitude } = getOrientation();
    return (alt, az) => (alt < -0.5 ? null : altAzToXYPointed(alt, az, altitude, azimuth, fov, rc));
  }
  applyView(rc); // map: zoom + pan the dome (mutates rc to match the render)
  return (alt, az) => (alt < 0 ? null : altAzToXY(alt, az, rc));
}

// A clean ring + crosshair ticks marking the currently selected object (map view).
function renderSelection(rc: RenderContext, project: AltAzProjector): void {
  const sel = state.selected;
  if (!sel) return;
  const p = project(sel.data.alt, sel.data.az);
  if (!p) return;
  const [x, y] = p;

  rc.ctx.strokeStyle = "rgba(120, 220, 255, 0.9)";
  rc.ctx.lineWidth = 1.5;
  rc.ctx.beginPath();
  rc.ctx.arc(x, y, 14, 0, Math.PI * 2);
  rc.ctx.stroke();

  rc.ctx.beginPath();
  for (const [ux, uy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    rc.ctx.moveTo(x + ux * 18, y + uy * 18);
    rc.ctx.lineTo(x + ux * 23, y + uy * 23);
  }
  rc.ctx.stroke();
}

// --- Render loop: throttled compute + draw-on-change ---
// The sky rotates ~0.004°/sec, so recomputing ~9k star positions every animation
// frame is pure waste. We recompute on a cadence (each computation still exact for
// its timestamp) and only redraw when something actually changed: new positions,
// orientation, zoom/pan, selection, or resize. An idle map view then sits near
// 1 fps instead of pinning a core at 60 fps.
const BODIES_INTERVAL_MS = 1000; // stars, planets, Moon, Sun — all slow movers
const SAT_INTERVAL_MS = 250;     // satellites move fast (ISS up to ~1°/s)

let lastBodiesAt = -Infinity;
let lastSatAt = -Infinity;
let needsRedraw = true;
let lastViewVersion = -1;
let lastOriAz = NaN;
let lastOriAlt = NaN;

function markDirty(): void {
  needsRedraw = true;
}

// Force an immediate recompute on the next frame (e.g. after a location change).
function invalidatePositions(): void {
  lastBodiesAt = -Infinity;
  lastSatAt = -Infinity;
  needsRedraw = true;
}

// Persistent status when idle: offline-degraded, stale-satellite warning, or clear.
function idleStatus(): string {
  if (starsData.length === 0 && tlesData.length === 0) {
    return "Offline: showing planets & Moon only.";
  }
  const meta = getTleMeta();
  if (meta.fromCache && meta.ageMs !== null) {
    const days = meta.ageMs / 86_400_000;
    if (days >= 3) return `Satellite data ${Math.round(days)} days old — Layers ▸ Refresh`;
  }
  return "";
}

// Manual data refresh: re-fetch star catalog + TLEs, bypassing the cache. Each
// source is independent so one failing doesn't lose the other.
async function refreshData(): Promise<void> {
  setStatus("Refreshing data…");
  const [stars, tles] = await Promise.allSettled([loadStars(true), loadTLEs(true)]);
  if (stars.status === "fulfilled") {
    starsData = stars.value;
    applyPrecession(new Date());
  }
  if (tles.status === "fulfilled") tlesData = tles.value;
  if (stars.status === "rejected" && tles.status === "rejected") {
    setStatus("Couldn't refresh — check your connection.");
  } else {
    setStatus(idleStatus());
  }
  invalidatePositions();
}

// Convert geocentric RA/Dec → apparent horizontal (alt/az), applying atmospheric
// refraction so objects sit where they actually appear (esp. near the horizon).
function toApparentHorizontal(ra: number, dec: number, lst: number): { az: number; alt: number } {
  const { az, alt } = equatorialToHorizontal({ ra, dec }, observer!, lst);
  return { az, alt: refractedAltitude(alt) };
}

function computeBodies(now: Date): void {
  if (!observer) return;
  const lst = getLST(now, observer.longitude);
  lastLST = lst;

  // Stars are precessed to date (precessedStars); apply refraction per star.
  lastStars = precessedStars.map((star) => ({
    ...star,
    ...toApparentHorizontal(star.ra, star.dec, lst),
  }));

  lastPlanets = getAllPlanets(now).map((p) => ({
    ...p,
    ...toApparentHorizontal(p.ra, p.dec, lst),
  }));

  // Moon: correct geocentric RA/Dec for topocentric parallax (up to ~1°) first.
  const moonPos = getMoonPosition(now);
  const topo = topocentricCorrection(
    moonPos.ra,
    moonPos.dec,
    moonPos.distanceKm,
    observer.latitude,
    lst
  );
  const moon = toApparentHorizontal(topo.ra, topo.dec, lst);
  lastMoon = { ...moonPos, az: moon.az, alt: moon.alt };

  const sunPos = getSunPosition(now);
  const sun = toApparentHorizontal(sunPos.ra, sunPos.dec, lst);
  lastSun = { ...sunPos, az: sun.az, alt: sun.alt };
}

function computeSatellites(now: Date): void {
  // A satellite is only naked-eye visible when the observer is in darkness AND the
  // satellite is sunlit (not in Earth's shadow). Otherwise show none — matching what
  // you'd actually see (you can't spot satellites in daylight).
  if (!observer || !lastSun || lastSun.alt >= -6) {
    lastSatellites = [];
    return;
  }

  // Sun direction in ECI (its geocentric equatorial RA/Dec → unit vector).
  const raR = lastSun.ra * (Math.PI / 180);
  const decR = lastSun.dec * (Math.PI / 180);
  const sunDir = {
    x: Math.cos(decR) * Math.cos(raR),
    y: Math.cos(decR) * Math.sin(raR),
    z: Math.sin(decR),
  };

  lastSatellites = getVisibleSatellites(tlesData, now, observer, sunDir)
    .filter((s) => s.sunlit) // sunlit passes only
    .map((s) => ({
      ...s,
      az: s.azimuth ?? 0,
      alt: refractedAltitude(s.elevationAngle ?? -90),
    }));
}

function draw(): void {
  const rc = initCanvas(canvas);
  const zoom = getZoom();
  const layers = getLayers();
  beginLabels();

  const sunAz = lastSun ? lastSun.az : 0;
  const trueSunAlt = lastSun ? lastSun.alt : -90;
  // "Daylight sky" tints the sky and dims stars by the Sun's altitude. When off,
  // the sky is always night-dark with full stars (classic planetarium). Even when
  // on, stars are floored so they never fully vanish during the day — the app is
  // for finding things, so you should always be able to see where they are.
  const daylight = layers.daylight;
  const sunAlt = daylight ? trueSunAlt : -90;
  const vis = daylight ? Math.max(0.5, starVisibility(trueSunAlt)) : 1;
  const magLimit = layers.magnitudeLimit;

  // Pick the view's projectors. `project` (RA/Dec) drives the reference overlays;
  // `projectAltAz` drives the bodies and the meridian. Everything below this point
  // is a single shared draw path — map and AR differ only in these two functions.
  const isAR = isSkyView && isListening();
  let project: EqProjector;
  let projectAltAz: AltAzProjector;

  if (isAR) {
    const fov = 90 / zoom; // narrower field of view = zoomed in
    const { azimuth, altitude } = getOrientation();
    const horizonY = rc.centerY + altitude * (Math.min(rc.width, rc.height) / fov);
    renderSkyAR(rc, sunAlt, horizonY);
    project = makeArProjector(rc, altitude, azimuth, fov);
    projectAltAz = (alt, az) =>
      alt < -0.5 ? null : altAzToXYPointed(alt, az, altitude, azimuth, fov, rc);
  } else {
    applyView(rc); // zoom + pan the dome
    renderSkyDome(rc, sunAlt, sunAz);
    project = makeMapProjector(rc);
    projectAltAz = (alt, az) => (alt < 0 ? null : altAzToXY(alt, az, rc));
  }

  // Reference overlays.
  if (layers.milkyway) renderMilkyWay(rc.ctx, project, MILKYWAY, vis);
  if (layers.grid) {
    renderEquatorialGrid(rc.ctx, project, 1);
    renderMeridian(rc.ctx, projectAltAz, 1);
  }
  if (layers.ecliptic) renderEcliptic(rc.ctx, project, ECLIPTIC, 1);
  if (layers.constellations) renderConstellationLines(rc.ctx, project, vis);

  // Bodies — one path for both views.
  renderStars(rc, lastStars, projectAltAz, vis, magLimit);
  renderSatellites(rc, lastSatellites, projectAltAz);
  renderPlanets(rc, lastPlanets, projectAltAz);
  if (lastMoon) renderMoon(rc, lastMoon, projectAltAz);
  if (lastSun) renderSun(rc, lastSun, projectAltAz);

  if (layers.constellations && layers.constellationNames) {
    renderConstellationNames(rc.ctx, project, vis);
  }

  renderSelection(rc, projectAltAz); // works in both views now

  if (isAR) {
    renderArHud(rc);
  } else {
    renderCompass(rc);
  }

  updateInfoPanel();
}

function loop(t: number): void {
  if (observer) {
    const now = new Date();

    if (t - lastBodiesAt >= BODIES_INTERVAL_MS) {
      computeBodies(now);
      lastBodiesAt = t;
      needsRedraw = true;
    }
    if (tlesData.length > 0 && t - lastSatAt >= SAT_INTERVAL_MS) {
      computeSatellites(now);
      lastSatAt = t;
      needsRedraw = true;
    }

    // Zoom / pan changes
    const vv = getViewVersion();
    if (vv !== lastViewVersion) {
      lastViewVersion = vv;
      needsRedraw = true;
    }

    // Orientation drives the sky-view projection; redraw only when it moves.
    if (isSkyView && isListening()) {
      const o = getOrientation();
      if (Math.abs(o.azimuth - lastOriAz) > 0.05 || Math.abs(o.altitude - lastOriAlt) > 0.05) {
        lastOriAz = o.azimuth;
        lastOriAlt = o.altitude;
        needsRedraw = true;
      }
    }

    if (needsRedraw) {
      draw();
      needsRedraw = false;
      revealOnce(); // first painted frame → fade out the loader, fade in the sky
    }
  }
  requestAnimationFrame(loop);
}

// --- Init ---
async function init() {
  // Each data source loads independently and never aborts startup.
  // Planets, the Moon, and the compass are pure math (no network), so the sky
  // must still render even if both network fetches fail (offline / CelesTrak down).
  setStatus("Loading star catalog...");
  starsData = await loadStars().catch((e) => {
    console.error("Star catalog failed to load:", e);
    return [];
  });
  applyPrecession(new Date()); // precess the J2000 catalog to the current epoch

  setStatus(
    starsData.length > 0
      ? `Loaded ${starsData.length} stars. Loading satellites...`
      : "Stars unavailable. Loading satellites..."
  );

  tlesData = await loadTLEs().catch((e) => {
    console.error("Satellite TLEs failed to load:", e);
    return [];
  });

  if (!observer) {
    setStatus("Requesting location...");
    try {
      observer = await requestLocation();
      saveLocation(observer);
    } catch {
      setStatus("Location denied. Using default (New York).");
      observer = { latitude: 40.7128, longitude: -74.006 };
    }
  }

  setStatus(idleStatus());
  initInfoPanel();

  // Manual location control — lets users pick any place on Earth and recover
  // from a denied geolocation prompt or a stale cached fix.
  initLocationControl({
    getCurrent: () => observer,
    onChange: (loc) => {
      observer = loc;
      saveLocation(loc);
      setStatus("");
      invalidatePositions(); // new location → recompute everything next frame
    },
  });

  // Prominent day/night toggle. Daylight tints the sky and dims stars by the Sun's
  // altitude; turning it off gives a dark, star-filled sky at any time of day.
  const dayBtn = document.createElement("button");
  dayBtn.id = "day-btn";
  dayBtn.className = "ui-chip";
  dayBtn.style.cssText = "position:fixed;top:64px;left:16px;z-index:200;";
  const syncDayBtn = () => {
    dayBtn.textContent = getLayers().daylight ? "☀ Daylight" : "☾ Night sky";
  };
  syncDayBtn();
  dayBtn.addEventListener("click", () => {
    setLayer("daylight", !getLayers().daylight);
    syncDayBtn();
    markDirty();
  });
  document.body.appendChild(dayBtn);

  // Layers toggle panel (constellations, Milky Way, ecliptic, grid) + data refresh.
  initLayersControl(markDirty, refreshData);

  // Mode toggle button
const modeBtn = document.createElement("button");
modeBtn.id = "mode-btn";
modeBtn.className = "ui-chip";
modeBtn.textContent = "⊕ Sky View";
modeBtn.style.cssText = "position:fixed;top:16px;right:16px;z-index:200;";
document.body.appendChild(modeBtn);

modeBtn.addEventListener("click", () => {
  if (!isSkyView) {
    showPermissionPrompt(() => {
      isSkyView = true;
      modeBtn.textContent = "⊙ Map View";
      markDirty(); // switching views changes what's drawn
    });
  } else {
    isSkyView = false;
    modeBtn.textContent = "⊕ Sky View";
    markDirty();
  }
});

  initZoom(canvas);

canvas.addEventListener("click", (e) => {
  if (recentlyInteracted()) return; // ignore the click that ends a drag
  const project = bodyProjectorForView(initCanvas(canvas));
  handleClick(e, canvas, project, lastStars, lastPlanets, lastSatellites, lastMoon, lastSun);
  updateInfoPanel();
  markDirty(); // selection changed → redraw the highlight ring
});

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  if (recentlyInteracted()) return; // the pointer-up ending a pan/pinch isn't a tap
  const project = bodyProjectorForView(initCanvas(canvas));
  handleClick(e, canvas, project, lastStars, lastPlanets, lastSatellites, lastMoon, lastSun);
  updateInfoPanel();
  markDirty();
});

  // Redraw when the viewport changes size.
  window.addEventListener("resize", markDirty);
  window.addEventListener("orientationchange", markDirty);

  requestAnimationFrame(loop);
}

init();