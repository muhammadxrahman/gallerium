import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { showPermissionPrompt } from "./components/PermissionPrompt";
import { getOrientation, isListening, getHeadingOffset, setHeadingOffset } from "./components/Orientation";
import { initInfoPanel, updateInfoPanel } from "./components/InfoPanel";
import { handleClick } from "./components/HitDetection";
import {
  initCanvas,
  renderCompass,
  altAzToXY,
  makePointedProjector,
  type RenderContext,
  type EqProjector,
  type AltAzProjector,
} from "./render/canvas";
import { renderStars } from "./render/stars";
import { renderDeepSky } from "./render/deepSky";
import { renderPlanets } from "./render/planets";
import { renderSatellites } from "./render/satellites";
import { renderMoon } from "./render/moon";
import { renderSun } from "./render/sun";
import { renderSkyDome, renderSkyAR, starVisibility } from "./render/sky";
import { renderConstellationLines, renderConstellationNames } from "./render/constellations";
import { renderEquatorialGrid, renderEcliptic, renderMeridian } from "./render/grid";
import { renderMilkyWay } from "./render/milkyway";
import { beginLabels } from "./render/labels";
import { loadStars } from "./data/stars";
import { loadTLEs, getTleMeta } from "./data/tles";
import { equatorialToHorizontal } from "./astronomy/coordinates";
import { eclipticPath, milkyWayBand } from "./astronomy/referenceLines";
import { requestLocation, cachedLocation, saveLocation } from "./utils/geo";
import { getSkyTime, isLive, setSkyTime } from "./utils/clock";
import { parseShareState, encodeShareState, type ShareState } from "./utils/shareUrl";
import { getFavorites, withFavoritesFirst } from "./store/favorites";
import { opticRingRadiusPx } from "./utils/optics";
import { lockHaptic, vibrate } from "./utils/haptics";
import { initLocationControl } from "./components/LocationControl";
import { buildLayersControls, getLayers } from "./components/Layers";
import { bortleLevel } from "./utils/bortle";
import { initTimeControl } from "./components/TimeControl";
import { initSearch } from "./components/Search";
import { initHighlights } from "./components/Highlights";
import { createToolbar, tbContent } from "./components/Toolbar";
import { initTour } from "./components/Tour";
import { icon } from "./components/icons";
import { initZoom, getZoom, setZoom, getPan, getViewVersion, recentlyInteracted, centerOn, resetView } from "./components/Zoom";
import { state } from "./store/state";
import { SkyEngine } from "./engine/SkyEngine";
import { targetAltAz, targetLabel, targetSelection, metaFromSelection, metaToSearchId, type TargetMeta } from "./engine/search";
import { createScheduler, tick, markDirty as schedMarkDirty, invalidate as schedInvalidate } from "./engine/scheduler";
import { idleStatus as computeIdleStatus } from "./engine/status";

// Static reference geometry, computed once.
const ECLIPTIC = eclipticPath(2);
const MILKYWAY = milkyWayBand();

// All astronomical state + the compute pipeline live in the engine.
const engine = new SkyEngine();

// UI / view state owned by the coordinator.
let isSkyView = false;
let currentTarget: TargetMeta | null = null;

const canvas = document.getElementById("sky-canvas") as HTMLCanvasElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const loaderEl = document.getElementById("loader");
const loaderTextEl = document.getElementById("loader-text");
let resetBtn: HTMLButtonElement | null = null;
let firstDrawDone = false;

// The view is "transformed" when zoomed or panned away from the default — used to show
// the reset button only when there's something to reset.
function isViewTransformed(): boolean {
  const p = getPan();
  return getZoom() !== 1 || p.x !== 0 || p.y !== 0;
}

function setStatus(msg: string) {
  statusEl.textContent = msg;
  if (loaderTextEl && !firstDrawDone && msg) loaderTextEl.textContent = msg;
}

// Reveal the sky and dismiss the loader once the first frame is painted.
function revealOnce(): void {
  if (firstDrawDone) return;
  firstDrawDone = true;
  canvas.classList.add("ready");
  loaderEl?.classList.add("hidden");
}

// Apply the user's zoom + pan to the map-view dome. Must be applied identically when
// rendering and when hit-testing so taps line up. Sky view is orientation-driven.
function applyView(rc: RenderContext): void {
  const { x, y } = getPan();
  rc.radius *= getZoom();
  rc.centerX += x;
  rc.centerY += y;
}

// Service worker: keep a home-screen (standalone) install fresh by polling for an
// updated SW on foreground + hourly (it otherwise serves the cached build forever).
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") registration.update();
    };
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("focus", checkForUpdate);
    setInterval(checkForUpdate, 60 * 60 * 1000);
  },
});

// --- Render loop state ---
// The cadence + draw-on-change decisions live in the pure scheduler (engine/scheduler.ts);
// this module just performs the side effects it asks for (recompute, draw).
const sched = createScheduler();

// Haptic-lock state: pulse once when a guided target enters the AR crosshair (engine in
// utils/haptics). Reset to armed whenever a new target is chosen.
let lockArmed = true;

function markDirty(): void {
  schedMarkDirty(sched);
}

// Force an immediate recompute next frame (e.g. after a location/time change).
function invalidatePositions(): void {
  schedInvalidate(sched);
}

// Persistent status when idle: offline-degraded, stale-satellite warning, or clear.
function idleStatus(): string {
  return computeIdleStatus(engine.hasStars(), engine.hasTles(), getTleMeta());
}

// Manual data refresh: re-fetch catalog + TLEs, bypassing cache. Each is independent.
async function refreshData(): Promise<void> {
  setStatus("Refreshing data…");
  const [stars, tles] = await Promise.allSettled([loadStars(true), loadTLEs(true)]);
  if (stars.status === "fulfilled") engine.setCatalog(stars.value, new Date());
  if (tles.status === "fulfilled") engine.setTles(tles.value);
  if (stars.status === "rejected" && tles.status === "rejected") {
    setStatus("Couldn't refresh — check your connection.");
  } else {
    setStatus(idleStatus());
  }
  invalidatePositions();
}

// --- Guide me there (search selection) ---
// Lock onto a target and guide there: select it (info card + ring), and either center
// the map on it or leave the AR arrow to point the way. Shared by search results and
// tapped Tonight-feed rows.
function guideTo(meta: TargetMeta | null): void {
  currentTarget = meta;
  lockArmed = true; // a fresh target can pulse once when reached
  if (!meta || !engine.observer) return;
  state.selected = targetSelection(meta, engine.bodies);

  const aa = targetAltAz(meta, engine.bodies, engine.observer);
  if (!aa) {
    setStatus(`${targetLabel(meta)} isn't available`);
  } else if (aa.alt < 0) {
    setStatus(`${targetLabel(meta)} is below the horizon`);
  } else if (!(isSkyView && isListening())) {
    const rc = initCanvas(canvas);
    const [x, y] = altAzToXY(aa.alt, aa.az, rc);
    centerOn(x, y, rc.centerX, rc.centerY, 2.5);
  }
  updateInfoPanel(engine.observer);
  markDirty();
}

function selectSearchResult(id: string): void {
  guideTo(engine.search.meta.get(id) ?? null);
}

// --- Share the view ---
// The current location + (frozen) time + zoom + guided target, as a restorable link.
function currentShareState(): ShareState {
  const s: ShareState = {};
  if (engine.observer) {
    s.latitude = engine.observer.latitude;
    s.longitude = engine.observer.longitude;
  }
  if (!isLive()) s.time = getSkyTime().getTime();
  const z = getZoom();
  if (z !== 1) s.zoom = z;
  if (currentTarget) {
    const id = metaToSearchId(currentTarget);
    if (id) s.target = id;
  }
  return s;
}

function buildShareUrl(): string {
  const q = encodeShareState(currentShareState());
  return location.origin + location.pathname + (q ? `?${q}` : "");
}

// Share via the OS share sheet when available (mobile), else copy the link.
async function shareView(): Promise<void> {
  const url = buildShareUrl();
  if (navigator.share) {
    try {
      await navigator.share({ title: "Gallerium", text: "My sky view", url });
    } catch {
      /* user dismissed the share sheet */
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    setStatus("Share link copied");
  } catch {
    setStatus(url);
  }
}

// Save the current canvas as a PNG download.
function saveImage(): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gallerium-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

// Restore location/time/zoom from a shared link parsed at startup; the target is applied
// after the first compute (it needs positioned bodies). Returns the parsed state.
const sharedView = parseShareState(window.location.search);

// --- Canvas overlays drawn by the coordinator ---
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
  rc.ctx.fillText(`Az ${azimuth.toFixed(0)}° · Alt ${altitude.toFixed(0)}°`, rc.centerX, rc.height - 20);
  rc.ctx.textAlign = "left";
}

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

// AR guidance: an arrow from the crosshair toward the searched target (turn this way).
function renderGuideArrow(rc: RenderContext, centerAz: number, centerAlt: number): void {
  if (!currentTarget || !engine.observer) return;
  const aa = targetAltAz(currentTarget, engine.bodies, engine.observer);
  if (!aa) return;
  const dAz = ((aa.az - centerAz + 540) % 360) - 180;
  const dAlt = aa.alt - centerAlt;
  const len = Math.hypot(dAz, dAlt);

  // A short haptic tick the moment the target enters the crosshair (fires once per lock).
  const h = lockHaptic(len, lockArmed);
  lockArmed = h.armed;
  if (h.pulse) vibrate();

  rc.ctx.save();
  rc.ctx.fillStyle = "rgba(120,220,255,0.95)";
  rc.ctx.strokeStyle = "rgba(120,220,255,0.95)";
  rc.ctx.font = "bold 13px ui-sans-serif, system-ui, sans-serif";
  rc.ctx.textAlign = "center";

  if (len < 2.5) {
    rc.ctx.lineWidth = 2;
    rc.ctx.beginPath();
    rc.ctx.arc(rc.centerX, rc.centerY, 22, 0, Math.PI * 2);
    rc.ctx.stroke();
    rc.ctx.fillText(targetLabel(currentTarget), rc.centerX, rc.centerY - 30);
  } else {
    const ux = dAz / len;
    const uy = -dAlt / len;
    const R = Math.min(rc.width, rc.height) * 0.3;
    const tx = rc.centerX + ux * R;
    const ty = rc.centerY + uy * R;
    const ang = Math.atan2(uy, ux);
    rc.ctx.lineWidth = 3;
    rc.ctx.beginPath();
    rc.ctx.moveTo(rc.centerX + ux * 40, rc.centerY + uy * 40);
    rc.ctx.lineTo(tx, ty);
    rc.ctx.stroke();
    rc.ctx.beginPath();
    rc.ctx.moveTo(tx, ty);
    rc.ctx.lineTo(tx - 12 * Math.cos(ang - 0.4), ty - 12 * Math.sin(ang - 0.4));
    rc.ctx.lineTo(tx - 12 * Math.cos(ang + 0.4), ty - 12 * Math.sin(ang + 0.4));
    rc.ctx.closePath();
    rc.ctx.fill();
    rc.ctx.fillText(targetLabel(currentTarget), tx, ty - 14);
  }
  rc.ctx.restore();
}

// --- Projectors: RA/Dec or alt/az → screen pixels for the active view ---
function makeMapProjector(rc: RenderContext): EqProjector {
  return (ra, dec) => {
    const { az, alt } = equatorialToHorizontal({ ra, dec }, engine.observer!, engine.bodies.lst);
    return alt < 0 ? null : altAzToXY(alt, az, rc);
  };
}

function makeArProjector(rc: RenderContext, centerAlt: number, centerAz: number, fov: number): EqProjector {
  const pointed = makePointedProjector(centerAlt, centerAz, fov, rc);
  return (ra, dec) => {
    const { az, alt } = equatorialToHorizontal({ ra, dec }, engine.observer!, engine.bodies.lst);
    return pointed(alt, az);
  };
}

// Body projector (alt/az → px) for the CURRENT view, used by hit detection so taps
// line up with the render — including AR. For the map it applies zoom/pan to rc.
function bodyProjectorForView(rc: RenderContext): AltAzProjector {
  if (isSkyView && isListening()) {
    const fov = 90 / getZoom();
    const { azimuth, altitude } = getOrientation();
    return makePointedProjector(altitude, azimuth, fov, rc);
  }
  applyView(rc);
  return (alt, az) => (alt < 0 ? null : altAzToXY(alt, az, rc));
}

function draw(): void {
  const rc = initCanvas(canvas);
  const zoom = getZoom();
  const layers = getLayers();
  const { stars, planets, deepSky, moon, sun } = engine.bodies;
  beginLabels();

  const sunAz = sun ? sun.az : 0;
  const trueSunAlt = sun ? sun.alt : -90;
  // Daylight tints the sky + dims stars by Sun altitude. Off → always-night, full
  // stars. On → stars floored so they never fully vanish (the app is for finding things).
  const daylight = layers.daylight;
  const sunAlt = daylight ? trueSunAlt : -90;
  const vis = daylight ? Math.max(0.5, starVisibility(trueSunAlt)) : 1;
  const magLimit = layers.magnitudeLimit;

  const isAR = isSkyView && isListening();
  let project: EqProjector;
  let projectAltAz: AltAzProjector;

  if (isAR) {
    const fov = 90 / zoom;
    const { azimuth, altitude } = getOrientation();
    const horizonY = rc.centerY + altitude * (Math.min(rc.width, rc.height) / fov);
    renderSkyAR(rc, sunAlt, horizonY);
    project = makeArProjector(rc, altitude, azimuth, fov);
    projectAltAz = makePointedProjector(altitude, azimuth, fov, rc);
  } else {
    applyView(rc);
    renderSkyDome(rc, sunAlt, sunAz);
    project = makeMapProjector(rc);
    projectAltAz = (alt, az) => (alt < 0 ? null : altAzToXY(alt, az, rc));
  }

  // Reference overlays.
  if (layers.milkyway) renderMilkyWay(rc.ctx, project, MILKYWAY, vis * bortleLevel(layers.bortle).milkyWay);
  if (layers.grid) {
    renderEquatorialGrid(rc.ctx, project, 1);
    renderMeridian(rc.ctx, projectAltAz, 1);
  }
  if (layers.ecliptic) renderEcliptic(rc.ctx, project, ECLIPTIC, 1);
  if (layers.constellations) renderConstellationLines(rc.ctx, project, vis);
  if (layers.deepSky) renderDeepSky(rc, deepSky, projectAltAz, vis);

  // Bodies — one path for both views.
  renderStars(rc, stars, projectAltAz, vis, magLimit);
  renderSatellites(rc, engine.satellites, projectAltAz);
  renderPlanets(rc, planets, projectAltAz);
  if (moon) renderMoon(rc, moon, projectAltAz);
  if (sun) renderSun(rc, sun, projectAltAz);

  if (layers.constellations && layers.constellationNames) {
    renderConstellationNames(rc.ctx, project, vis);
  }

  // Keep a guided (searched) target's selection live as the sky moves.
  if (currentTarget) state.selected = targetSelection(currentTarget, engine.bodies);
  renderSelection(rc, projectAltAz);

  if (isAR) {
    const o = getOrientation();
    if (layers.opticFov > 0) renderOpticRing(rc, layers.opticFov, 90 / zoom);
    renderArHud(rc);
    renderGuideArrow(rc, o.azimuth, o.altitude);
  } else {
    renderCompass(rc);
  }

  // Show the reset button only while the view is zoomed/panned.
  resetBtn?.classList.toggle("show", isViewTransformed());

  updateInfoPanel(engine.observer);
}

// AR-only "true field" ring: a circle the size of the chosen optic's field of view.
function renderOpticRing(rc: RenderContext, opticFov: number, viewFov: number): void {
  const r = opticRingRadiusPx(opticFov, viewFov, Math.min(rc.width, rc.height));
  if (r <= 0) return;
  rc.ctx.save();
  rc.ctx.strokeStyle = "rgba(120,220,255,0.45)";
  rc.ctx.setLineDash([4, 4]);
  rc.ctx.lineWidth = 1.5;
  rc.ctx.beginPath();
  rc.ctx.arc(rc.centerX, rc.centerY, r, 0, Math.PI * 2);
  rc.ctx.stroke();
  rc.ctx.restore();
}

function loop(t: number): void {
  if (engine.observer) {
    const now = getSkyTime(); // live wall clock, or the user's scrubbed time

    const r = tick(sched, {
      t,
      hasTles: engine.hasTles(),
      viewVersion: getViewVersion(),
      orientation: isSkyView && isListening() ? getOrientation() : null,
    });

    if (r.recomputeBodies) engine.recomputeBodies(now);
    if (r.recomputeSatellites) engine.recomputeSatellites(now);
    if (r.redraw) {
      draw();
      revealOnce();
    }
  }
  requestAnimationFrame(loop);
}

// --- Init ---
async function init() {
  // Each data source loads independently and never aborts startup. Planets, Moon, and
  // the compass are pure math, so the sky still renders fully offline.
  setStatus("Loading star catalog...");
  const stars = await loadStars().catch((e) => {
    console.error("Star catalog failed to load:", e);
    return [];
  });
  engine.setCatalog(stars, new Date());

  setStatus(
    engine.hasStars()
      ? `Loaded ${stars.length} stars. Loading satellites...`
      : "Stars unavailable. Loading satellites..."
  );

  engine.setTles(
    await loadTLEs().catch((e) => {
      console.error("Satellite TLEs failed to load:", e);
      return [];
    })
  );

  // A shared link's location wins (session-only — it isn't saved over the user's own).
  if (sharedView.latitude !== undefined && sharedView.longitude !== undefined) {
    engine.observer = { latitude: sharedView.latitude, longitude: sharedView.longitude };
  } else {
    engine.observer = cachedLocation();
    if (!engine.observer) {
      setStatus("Requesting location...");
      try {
        engine.observer = await requestLocation();
        saveLocation(engine.observer);
      } catch {
        setStatus("Location denied. Using default (New York).");
        engine.observer = { latitude: 40.7128, longitude: -74.006 };
      }
    }
  }

  // Restore a shared time + zoom.
  if (sharedView.time !== undefined) setSkyTime(new Date(sharedView.time));
  if (sharedView.zoom !== undefined) setZoom(sharedView.zoom);

  setStatus(idleStatus());
  initInfoPanel();

  // Controls that open from the toolbar / settings sheet.
  const location = initLocationControl({
    getCurrent: () => engine.observer,
    onChange: (loc) => {
      engine.observer = loc;
      saveLocation(loc);
      setStatus("");
      invalidatePositions();
    },
  });
  let timeBtn: HTMLButtonElement | undefined;
  const time = initTimeControl(() => {
    invalidatePositions();
    markDirty();
    timeBtn?.classList.toggle("tb-btn-active", !isLive());
  });
  const search = initSearch(
    () => withFavoritesFirst(engine.search.items, getFavorites()),
    selectSearchResult
  );
  const tonight = initHighlights(() => engine.highlights(getSkyTime()), guideTo);

  // --- Bottom toolbar ---
  const toolbar = createToolbar();
  toolbar.addButton({ icon: icon("search"), label: "Search", onClick: search.open });
  timeBtn = toolbar.addButton({ icon: icon("clock"), label: "Time", onClick: time.open });

  const viewBtn = toolbar.addButton({
    icon: icon("sky"),
    label: "Sky",
    onClick: () => {
      if (!isSkyView) {
        showPermissionPrompt(() => {
          isSkyView = true;
          viewBtn.innerHTML = tbContent(icon("map"), "Map");
          markDirty();
        });
      } else {
        isSkyView = false;
        viewBtn.innerHTML = tbContent(icon("sky"), "Sky");
        markDirty();
      }
    },
  });

  toolbar.addButton({ icon: icon("star"), label: "Tonight", onClick: tonight.open });
  toolbar.addButton({ icon: icon("sliders"), label: "Settings", onClick: toolbar.openSettings });

  // A shared link may have restored a frozen time — reflect it on the Time button.
  if (!isLive()) timeBtn.classList.add("tb-btn-active");

  // Top-right help button: opens the replayable feature tour. A standalone affordance
  // (not buried in settings) so a first-time user spots it immediately.
  const tour = initTour();
  const helpBtn = document.createElement("button");
  helpBtn.className = "help-fab";
  helpBtn.setAttribute("aria-label", "Take a tour");
  helpBtn.innerHTML = icon("help", 22);
  helpBtn.addEventListener("click", tour.open);
  document.body.appendChild(helpBtn);

  // Reset-zoom button (top-left): appears only when zoomed/panned. The reliable way to
  // reset on touch, since iOS doesn't fire `dblclick` for double-taps; desktop also keeps
  // double-click. draw() toggles its `.show` based on the view transform.
  resetBtn = document.createElement("button");
  resetBtn.className = "reset-fab";
  resetBtn.setAttribute("aria-label", "Reset zoom");
  resetBtn.innerHTML = `${icon("reset", 18)}<span>Reset</span>`;
  resetBtn.addEventListener("click", () => {
    resetView();
    markDirty();
  });
  document.body.appendChild(resetBtn);

  // --- Settings sheet contents ---
  // Night vision is a CSS-only mode (a red multiply veil over everything); reflect the
  // layer state onto the body class. Applied on any layer change and once at startup.
  const applyDisplayModes = () => {
    document.body.classList.toggle("night-vision", getLayers().nightVision);
  };
  applyDisplayModes();
  buildLayersControls(toolbar.settingsBody, () => {
    applyDisplayModes();
    markDirty();
  });

  const locationRow = document.createElement("button");
  locationRow.className = "ui-chip";
  locationRow.style.cssText = "width:100%;justify-content:center;margin-top:10px;";
  locationRow.innerHTML = tbContent(icon("pin", 18), "Set location");
  locationRow.addEventListener("click", location.open);
  toolbar.settingsBody.appendChild(locationRow);

  const refreshRow = document.createElement("button");
  refreshRow.className = "ui-chip";
  refreshRow.style.cssText = "width:100%;justify-content:center;margin-top:8px;";
  refreshRow.innerHTML = tbContent(icon("refresh", 18), "Refresh data");
  refreshRow.addEventListener("click", refreshData);
  toolbar.settingsBody.appendChild(refreshRow);

  // Share the current view (location + time + zoom + target) as a link, and save the sky
  // as a PNG.
  const shareRow = document.createElement("button");
  shareRow.className = "ui-chip";
  shareRow.style.cssText = "width:100%;justify-content:center;margin-top:8px;";
  shareRow.innerHTML = tbContent(icon("share", 18), "Share view");
  shareRow.addEventListener("click", shareView);
  toolbar.settingsBody.appendChild(shareRow);

  const saveRow = document.createElement("button");
  saveRow.className = "ui-chip";
  saveRow.style.cssText = "width:100%;justify-content:center;margin-top:8px;";
  saveRow.innerHTML = tbContent(icon("image", 18), "Save image");
  saveRow.addEventListener("click", saveImage);
  toolbar.settingsBody.appendChild(saveRow);

  // Compass calibration: nudge the Sky-view heading until it lines up with the real sky
  // (phone compasses can read tens of degrees off). Only affects the AR view.
  const calWrap = document.createElement("div");
  calWrap.style.cssText = "padding:12px 8px 4px;";
  const calLabel = document.createElement("div");
  calLabel.style.cssText =
    "font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px;display:flex;justify-content:space-between;";
  const calSlider = document.createElement("input");
  calSlider.type = "range";
  calSlider.min = "-180";
  calSlider.max = "180";
  calSlider.step = "1";
  calSlider.value = String(getHeadingOffset());
  calSlider.style.cssText = "width:100%;";
  const updateCal = () => {
    const v = getHeadingOffset();
    calLabel.innerHTML = `<span>Compass calibration (Sky view)</span><span style="color:rgba(255,255,255,0.85)">${v > 0 ? "+" : ""}${v}°</span>`;
  };
  updateCal();
  calSlider.addEventListener("input", () => {
    setHeadingOffset(parseFloat(calSlider.value));
    updateCal();
    markDirty();
  });
  calWrap.appendChild(calLabel);
  calWrap.appendChild(calSlider);
  toolbar.settingsBody.appendChild(calWrap);

  initZoom(canvas);

  const onTap = (e: MouseEvent | TouchEvent) => {
    const project = bodyProjectorForView(initCanvas(canvas));
    const { stars, planets, deepSky, moon, sun } = engine.bodies;
    handleClick(e, canvas, project, stars, planets, engine.satellites, moon, sun, deepSky);
    // Lock onto whatever was tapped so the selection tracks it as time moves (and the
    // AR arrow guides back to it). Tapping empty space clears the lock. Satellites
    // resolve to null and keep their snapshot — see metaFromSelection.
    currentTarget = metaFromSelection(state.selected);
    updateInfoPanel(engine.observer);
    markDirty();
  };

  canvas.addEventListener("click", (e) => {
    if (recentlyInteracted()) return; // ignore the click that ends a drag
    onTap(e);
  });
  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (recentlyInteracted()) return; // the pointer-up ending a pan/pinch isn't a tap
    onTap(e);
  });

  window.addEventListener("resize", markDirty);
  window.addEventListener("orientationchange", markDirty);

  // Restore a shared guide target: needs positioned bodies, so compute once first.
  if (sharedView.target && engine.observer) {
    engine.recomputeBodies(getSkyTime());
    selectSearchResult(sharedView.target);
  }

  requestAnimationFrame(loop);
}

init();
