import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { showPermissionPrompt, } from "./components/PermissionPrompt";
import { getOrientation, isListening } from "./components/Orientation";
import { initInfoPanel, updateInfoPanel } from "./components/InfoPanel";
import { handleClick } from "./components/HitDetection";
import { initCanvas, clearCanvas, renderCompass, altAzToXYPointed, type RenderContext } from "./render/canvas";
import { renderStars, type RenderedStar } from "./render/stars";
import { renderPlanets, type RenderedPlanet } from "./render/planets";
import { renderSatellites, type RenderedSatellite } from "./render/satellites";
import { renderMoon, type RenderedMoon } from "./render/moon";
import { renderSun, type RenderedSun } from "./render/sun";
import { loadStars } from "./data/stars";
import { loadTLEs } from "./data/tles";
import { equatorialToHorizontal } from "./astronomy/coordinates";
import { getLST } from "./astronomy/sidereal";
import { getAllPlanets } from "./astronomy/planets";
import { getVisibleSatellites } from "./astronomy/satellites";
import { requestLocation, cachedLocation, saveLocation } from "./utils/geo";
import { initLocationControl } from "./components/LocationControl";
import { initZoom, getZoom, getPan, recentlyInteracted } from "./components/Zoom";
import type { Observer } from "./astronomy/coordinates";
import { getMoonPosition } from "./astronomy/moon";
import { getSunPosition } from "./astronomy/sun";

// --- State ---
let observer: Observer | null = cachedLocation();
let lastStars: RenderedStar[] = [];
let lastPlanets: RenderedPlanet[] = [];
let lastSatellites: RenderedSatellite[] = [];
let lastMoon: RenderedMoon | null = null;
let lastSun: RenderedSun | null = null;
let isSkyView = false;

const canvas = document.getElementById("sky-canvas") as HTMLCanvasElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

// --- Preloaded data ---
let starsData: Awaited<ReturnType<typeof loadStars>> = [];
let tlesData: Awaited<ReturnType<typeof loadTLEs>> = [];

function setStatus(msg: string) {
  statusEl.textContent = msg;
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

function renderSkyView(
  rc: RenderContext,
  stars: RenderedStar[],
  planets: RenderedPlanet[],
  satellites: RenderedSatellite[],
  centerAz: number,
  centerAlt: number,
  FOV: number // degrees visible at once (narrower = zoomed in)
): void {

  // Stars
  for (const star of stars) {
    const pos = altAzToXYPointed(star.alt, star.az, centerAlt, centerAz, FOV, rc);
    if (!pos) continue;
    const [x, y] = pos;

    const radius = Math.max(0.5, 3.5 - star.magnitude * 0.5);
    rc.ctx.fillStyle = "#ffffff";
    rc.ctx.beginPath();
    rc.ctx.arc(x, y, radius, 0, Math.PI * 2);
    rc.ctx.fill();

    if (star.name && star.magnitude < 2.5) {
      rc.ctx.fillStyle = "rgba(255,255,255,0.7)";
      rc.ctx.font = "11px sans-serif";
      rc.ctx.fillText(star.name, x + radius + 3, y + 3);
    }
  }

  // Planets
  for (const planet of planets) {
    const pos = altAzToXYPointed(planet.alt, planet.az, centerAlt, centerAz, FOV, rc);
    if (!pos) continue;
    const [x, y] = pos;

    rc.ctx.fillStyle = "#fffacd";
    rc.ctx.beginPath();
    rc.ctx.arc(x, y, 5, 0, Math.PI * 2);
    rc.ctx.fill();

    rc.ctx.fillStyle = "rgba(255,255,255,0.85)";
    rc.ctx.font = "12px sans-serif";
    rc.ctx.fillText(planet.name, x + 7, y + 4);
  }

  // Satellites
  for (const sat of satellites) {
    if (sat.alt < 10) continue;
    const pos = altAzToXYPointed(sat.alt, sat.az, centerAlt, centerAz, FOV, rc);
    if (!pos) continue;
    const [x, y] = pos;

    rc.ctx.fillStyle = "rgba(0, 255, 136, 0.8)";
    rc.ctx.beginPath();
    rc.ctx.arc(x, y, sat.name.includes("ISS") ? 4 : 2, 0, Math.PI * 2);
    rc.ctx.fill();

    if (sat.name.includes("ISS")) {
      rc.ctx.fillStyle = "rgba(0,255,136,0.9)";
      rc.ctx.font = "bold 12px sans-serif";
      rc.ctx.fillText("ISS", x + 6, y + 4);
    }
  }

  // Crosshair at center
  rc.ctx.strokeStyle = "rgba(255,255,255,0.2)";
  rc.ctx.lineWidth = 1;
  rc.ctx.beginPath();
  rc.ctx.moveTo(rc.centerX - 15, rc.centerY);
  rc.ctx.lineTo(rc.centerX + 15, rc.centerY);
  rc.ctx.moveTo(rc.centerX, rc.centerY - 15);
  rc.ctx.lineTo(rc.centerX, rc.centerY + 15);
  rc.ctx.stroke();

  // Compass heading display
  const { azimuth, altitude } = getOrientation();
  rc.ctx.fillStyle = "rgba(255,255,255,0.5)";
  rc.ctx.font = "12px sans-serif";
  rc.ctx.textAlign = "center";
  rc.ctx.fillText(
    `Az ${azimuth.toFixed(0)}° · Alt ${altitude.toFixed(0)}°`,
    rc.centerX,
    rc.height - 20
  );
  rc.ctx.textAlign = "left";
}

// --- Main render loop ---
function renderFrame() {
  if (!observer) return;

  const rc = initCanvas(canvas);
  const zoom = getZoom();
  clearCanvas(rc);

  const now = new Date();
  const lst = getLST(now, observer.longitude);

  // Stars
  const rendered: RenderedStar[] = starsData.map((star) => {
    const { az, alt } = equatorialToHorizontal(
      { ra: star.ra, dec: star.dec },
      observer!,
      lst
    );
    return { ...star, az, alt };
  });

  // Planets
  const planets = getAllPlanets(now);
  const renderedPlanets: RenderedPlanet[] = planets.map((p) => {
    const { az, alt } = equatorialToHorizontal(
      { ra: p.ra, dec: p.dec },
      observer!,
      lst
    );
    return { ...p, az, alt };
  });

  // Moon
  const moonPos = getMoonPosition(now);
  const { az: moonAz, alt: moonAlt } = equatorialToHorizontal(
    { ra: moonPos.ra, dec: moonPos.dec },
    observer!,
    lst
  );
  const renderedMoon: RenderedMoon = { ...moonPos, az: moonAz, alt: moonAlt };

  // Sun
  const sunPos = getSunPosition(now);
  const { az: sunAz, alt: sunAlt } = equatorialToHorizontal(
    { ra: sunPos.ra, dec: sunPos.dec },
    observer!,
    lst
  );
  const renderedSun: RenderedSun = { ...sunPos, az: sunAz, alt: sunAlt };

  // Satellites — use topocentric look angles computed against the observer.
  // Satellites are near-field, so the geocentric RA/Dec → horizontal path used
  // for stars/planets would be wildly off; getVisibleSatellites gives true az/alt.
  const sats = getVisibleSatellites(tlesData, now, observer);
  const renderedSats: RenderedSatellite[] = sats.map((s) => ({
    ...s,
    az: s.azimuth ?? 0,
    alt: s.elevationAngle ?? -90,
  }));

  lastStars = rendered;
  lastPlanets = renderedPlanets;
  lastSatellites = renderedSats;
  lastMoon = renderedMoon;
  lastSun = renderedSun;

  if (isSkyView && isListening()) {
    const fov = 90 / zoom; // narrower field of view = zoomed in
    const { azimuth, altitude } = getOrientation();
    renderSkyView(rc, rendered, renderedPlanets, renderedSats, azimuth, altitude, fov);
    renderMoon(rc, renderedMoon, true, azimuth, altitude, fov);
    renderSun(rc, renderedSun, true, azimuth, altitude, fov);
  } else {
    applyView(rc); // zoom + pan the dome
    renderStars(rc, rendered);
    renderPlanets(rc, renderedPlanets);
    renderSatellites(rc, renderedSats);
    renderMoon(rc, renderedMoon, false);
    renderSun(rc, renderedSun, false);
    renderCompass(rc);
  }

  updateInfoPanel();
  requestAnimationFrame(renderFrame);
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

  // Keep a persistent hint when running degraded; otherwise clear the status.
  if (starsData.length === 0 && tlesData.length === 0) {
    setStatus("Offline: showing planets & Moon only.");
  } else {
    setStatus("");
  }
  initInfoPanel();

  // Manual location control — lets users pick any place on Earth and recover
  // from a denied geolocation prompt or a stale cached fix.
  initLocationControl({
    getCurrent: () => observer,
    onChange: (loc) => {
      observer = loc;
      saveLocation(loc);
      setStatus("");
    },
  });

  // Mode toggle button
const modeBtn = document.createElement("button");
modeBtn.id = "mode-btn";
modeBtn.textContent = "⊕ Sky View";
modeBtn.style.cssText = `
  position: fixed;
  top: 16px;
  right: 16px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.25);
  border-radius: 20px;
  color: white;
  font-size: 13px;
  padding: 8px 16px;
  cursor: pointer;
  z-index: 200;
  backdrop-filter: blur(8px);
`;
document.body.appendChild(modeBtn);

modeBtn.addEventListener("click", () => {
  if (!isSkyView) {
    showPermissionPrompt(() => {
      isSkyView = true;
      modeBtn.textContent = "⊙ Map View";
    });
  } else {
    isSkyView = false;
    modeBtn.textContent = "⊕ Sky View";
  }
});

  initZoom(canvas);

canvas.addEventListener("click", (e) => {
  if (recentlyInteracted()) return; // ignore the click that ends a drag
  const rc = initCanvas(canvas);
  applyView(rc); // match the zoomed/panned render so hits line up
  handleClick(e, rc, lastStars, lastPlanets, lastSatellites, lastMoon, lastSun);
  updateInfoPanel();
});

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  if (recentlyInteracted()) return; // the pointer-up ending a pan/pinch isn't a tap
  const rc = initCanvas(canvas);
  applyView(rc);
  handleClick(e, rc, lastStars, lastPlanets, lastSatellites, lastMoon, lastSun);
  updateInfoPanel();
});
  renderFrame();
}

init();