import "./style.css";
import { showPermissionPrompt, } from "./components/PermissionPrompt";
import { getOrientation, isListening } from "./components/Orientation";
import { initInfoPanel, updateInfoPanel } from "./components/InfoPanel";
import { handleClick } from "./components/HitDetection";
import { initCanvas, clearCanvas, renderCompass, altAzToXYPointed, type RenderContext, altAzToXY } from "./render/canvas";
import { renderStars, type RenderedStar } from "./render/stars";
import { renderPlanets, type RenderedPlanet } from "./render/planets";
import { renderSatellites, type RenderedSatellite } from "./render/satellites";
import { loadStars } from "./data/stars";
import { loadTLEs } from "./data/tles";
import { equatorialToHorizontal } from "./astronomy/coordinates";
import { getLST } from "./astronomy/sidereal";
import { getAllPlanets } from "./astronomy/planets";
import { getVisibleSatellites } from "./astronomy/satellites";
import { requestLocation, cachedLocation, saveLocation } from "./utils/geo";
import type { Observer } from "./astronomy/coordinates";
import { getMoonPosition, type MoonPosition } from "./astronomy/moon";

// --- State ---
let observer: Observer | null = cachedLocation();
let lastStars: RenderedStar[] = [];
let lastPlanets: RenderedPlanet[] = [];
let lastSatellites: RenderedSatellite[] = [];
let isSkyView = false;

const canvas = document.getElementById("sky-canvas") as HTMLCanvasElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

// --- Preloaded data ---
let starsData: Awaited<ReturnType<typeof loadStars>> = [];
let tlesData: Awaited<ReturnType<typeof loadTLEs>> = [];

function setStatus(msg: string) {
  statusEl.textContent = msg;
}

function renderSkyView(
  rc: RenderContext,
  stars: RenderedStar[],
  planets: RenderedPlanet[],
  satellites: RenderedSatellite[],
  centerAz: number,
  centerAlt: number
): void {
  const FOV = 90; // degrees visible at once

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

function renderMoon(
  rc: RenderContext,
  moon: MoonPosition & { az: number; alt: number },
  pointed: boolean,
  centerAz?: number,
  centerAlt?: number,
  fov?: number
): void {
  let pos: [number, number] | null = null;

  if (pointed && centerAz !== undefined && centerAlt !== undefined && fov !== undefined) {
    pos = altAzToXYPointed(moon.alt, moon.az, centerAlt, centerAz, fov, rc);
  } else {
    if (moon.alt < 0) return;
    const [x, y] = altAzToXY(moon.alt, moon.az, rc);
    pos = [x, y];
  }

  if (!pos) return;
  const [x, y] = pos;

  const radius = 8;
  const illumination = moon.illumination;

  // Glow
  const glow = rc.ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
  glow.addColorStop(0, "rgba(255, 248, 220, 0.4)");
  glow.addColorStop(1, "transparent");
  rc.ctx.fillStyle = glow;
  rc.ctx.beginPath();
  rc.ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
  rc.ctx.fill();

  // Moon disc
  rc.ctx.fillStyle = "#fffdf0";
  rc.ctx.beginPath();
  rc.ctx.arc(x, y, radius, 0, Math.PI * 2);
  rc.ctx.fill();

  // Shadow to show phase
  rc.ctx.fillStyle = "rgba(0, 0, 8, 0.85)";
  rc.ctx.beginPath();
  if (illumination < 0.5) {
    // More than half dark
    rc.ctx.arc(x, y, radius, Math.PI / 2, -Math.PI / 2, false);
    const k = (1 - illumination * 2);
    rc.ctx.ellipse(x, y, radius * k, radius, 0, -Math.PI / 2, Math.PI / 2, false);
  } else {
    // More than half lit
    rc.ctx.arc(x, y, radius, Math.PI / 2, -Math.PI / 2, true);
    const k = (illumination * 2 - 1);
    rc.ctx.ellipse(x, y, radius * k, radius, 0, -Math.PI / 2, Math.PI / 2, true);
  }
  rc.ctx.fill();

  // Label
  rc.ctx.fillStyle = "rgba(255, 248, 220, 0.85)";
  rc.ctx.font = "12px sans-serif";
  rc.ctx.fillText(`Moon ${Math.round(illumination * 100)}%`, x + radius + 4, y + 4);
}

// --- Main render loop ---
function renderFrame() {
  if (!observer) return;

  const rc = initCanvas(canvas);
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
  const renderedMoon = { ...moonPos, az: moonAz, alt: moonAlt };

  // Satellites
  const sats = getVisibleSatellites(tlesData, now);
  const renderedSats: RenderedSatellite[] = sats.map((s) => {
    const { az, alt } = equatorialToHorizontal(
      { ra: s.ra, dec: s.dec },
      observer!,
      lst
    );
    return { ...s, az, alt };
  });

  lastStars = rendered;
  lastPlanets = renderedPlanets;
  lastSatellites = renderedSats;

  if (isSkyView && isListening()) {
    const { azimuth, altitude } = getOrientation();
    renderSkyView(rc, rendered, renderedPlanets, renderedSats, azimuth, altitude);
    renderMoon(rc, renderedMoon, true, azimuth, altitude, 90);
  } else {
    renderStars(rc, rendered);
    renderPlanets(rc, renderedPlanets);
    renderSatellites(rc, renderedSats);
    renderMoon(rc, renderedMoon, false);
    renderCompass(rc);
  }

  updateInfoPanel();
  requestAnimationFrame(renderFrame);
}

// --- Init ---
async function init() {
  setStatus("Loading star catalog...");
  try {
    starsData = await loadStars();
    setStatus(`Loaded ${starsData.length} stars. Loading satellites...`);
    tlesData = await loadTLEs();
    setStatus(`Loaded ${tlesData.length} satellites.`);
  } catch (e) {
    setStatus("Failed to load data. Check your connection.");
    console.error(e);
    return;
  }

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

  setStatus("");
  initInfoPanel();

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

canvas.addEventListener("click", (e) => {
  const rc = initCanvas(canvas);
  handleClick(e, rc, lastStars, lastPlanets, lastSatellites);
  updateInfoPanel();
});

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  const rc = initCanvas(canvas);
  handleClick(e, rc, lastStars, lastPlanets, lastSatellites);
  updateInfoPanel();
});
  renderFrame();
}

init();