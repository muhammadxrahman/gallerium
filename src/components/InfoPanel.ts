import { state } from "../store/state";
import { riseTransitSet, STD_ALT_STAR, STD_ALT_SUN } from "../astronomy/riseset";
import { moonPhaseName } from "../astronomy/moon";
import { altitudeTrack, sunAltitudeTrack } from "../astronomy/altitudeTrack";
import { altitudeSparkline } from "./altitudeSparkline";
import { getSkyTime } from "../utils/clock";
import { DEEP_SKY_KIND_LABEL } from "../data/deepSky";
import type { Observer } from "../astronomy/coordinates";

let panel: HTMLDivElement | null = null;

function clockStr(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Rise/set rows for a fixed-ish body (skipped for fast satellites).
// (moonPhaseName now lives in astronomy/moon.ts and is imported above.)
function riseSetRows(
  ra: number,
  dec: number,
  observer: Observer | null,
  h0: number
): Array<[string, string]> {
  if (!observer) return [];
  const r = riseTransitSet(ra, dec, observer, getSkyTime(), h0);
  if (r.circumpolar) return [["Visibility", "Always up"]];
  if (r.neverRises) return [["Visibility", "Below horizon"]];
  const rows: Array<[string, string]> = [];
  if (r.rise) rows.push(["Rises", clockStr(r.rise)]);
  if (r.set) rows.push(["Sets", clockStr(r.set)]);
  return rows;
}

const ACCENT: Record<string, string> = {
  STAR: "#aab4ff",
  PLANET: "#ffd9a0",
  MOON: "#fff3c4",
  SUN: "#ffd36b",
  SATELLITE: "#7cffb0",
  "DEEP SKY": "#d6bfff",
};

export function initInfoPanel(): void {
  panel = document.createElement("div");
  panel.id = "info-panel";
  document.body.appendChild(panel);
}

// An "altitude tonight" sparkline for a fixed-ish body: where it sits over the next 24h,
// with the dark hours shaded. Empty string when there's no observer (nothing to compute).
function altChart(ra: number, dec: number, observer: Observer | null): string {
  if (!observer) return "";
  const start = getSkyTime();
  const obj = altitudeTrack(ra, dec, observer, start);
  const sun = sunAltitudeTrack(observer, start);
  const svg = altitudeSparkline(obj, sun);
  return svg ? `<div class="info-chart-label">Altitude · next 24h</div>${svg}` : "";
}

function card(type: string, name: string, stats: Array<[string, string]>, chart = ""): string {
  const accent = ACCENT[type] ?? "#ffffff";
  const rows = stats
    .map(
      ([k, v]) =>
        `<div class="info-stat-label">${k}</div><div class="info-stat-value">${v}</div>`
    )
    .join("");
  return `
    <div class="info-head">
      <span class="info-badge" style="background:${accent}22;color:${accent}">${type}</span>
      <div class="info-name">${name}</div>
    </div>
    <div class="info-stats">${rows}</div>
    ${chart}
  `;
}

export function updateInfoPanel(observer: Observer | null = null): void {
  if (!panel) return;
  const obj = state.selected;

  if (!obj) {
    panel.classList.remove("show");
    return;
  }
  panel.classList.add("show");

  if (obj.type === "star") {
    const s = obj.data;
    panel.innerHTML = card("STAR", s.name ?? `Star #${s.id}`, [
      ["Altitude", `${s.alt.toFixed(1)}°`],
      ["Azimuth", `${s.az.toFixed(1)}°`],
      ["Magnitude", s.magnitude.toFixed(2)],
      ["Color index", s.colorIndex.toFixed(2)],
      ...riseSetRows(s.ra, s.dec, observer, STD_ALT_STAR),
    ], altChart(s.ra, s.dec, observer));
  } else if (obj.type === "planet") {
    const p = obj.data;
    panel.innerHTML = card("PLANET", p.name, [
      ["Altitude", `${p.alt.toFixed(1)}°`],
      ["Azimuth", `${p.az.toFixed(1)}°`],
      ["Magnitude", p.magnitude.toFixed(1)],
      ["Illumination", `${Math.round(p.phase * 100)}%`],
      ...riseSetRows(p.ra, p.dec, observer, STD_ALT_STAR),
    ], altChart(p.ra, p.dec, observer));
  } else if (obj.type === "sun") {
    const s = obj.data;
    panel.innerHTML = card("SUN", "Sun", [
      ["Altitude", `${s.alt.toFixed(1)}°`],
      ["Azimuth", `${s.az.toFixed(1)}°`],
      ...riseSetRows(s.ra, s.dec, observer, STD_ALT_SUN),
    ], altChart(s.ra, s.dec, observer));
  } else if (obj.type === "moon") {
    const m = obj.data;
    panel.innerHTML = card("MOON", "Moon", [
      ["Altitude", `${m.alt.toFixed(1)}°`],
      ["Azimuth", `${m.az.toFixed(1)}°`],
      ["Illumination", `${Math.round(m.illumination * 100)}%`],
      ["Phase", moonPhaseName(m.illumination, m.waxing)],
      ...riseSetRows(m.ra, m.dec, observer, STD_ALT_STAR),
    ], altChart(m.ra, m.dec, observer));
  } else if (obj.type === "satellite") {
    const s = obj.data;
    panel.innerHTML = card("SATELLITE", s.name, [
      ["Altitude", `${s.alt.toFixed(1)}°`],
      ["Azimuth", `${s.az.toFixed(1)}°`],
      ["Orbital height", `${s.altitude.toFixed(0)} km`],
    ]);
  } else if (obj.type === "deepsky") {
    const d = obj.data;
    panel.innerHTML = card("DEEP SKY", d.name === d.id ? d.id : `${d.name} (${d.id})`, [
      ["Type", DEEP_SKY_KIND_LABEL[d.kind]],
      ["Altitude", `${d.alt.toFixed(1)}°`],
      ["Azimuth", `${d.az.toFixed(1)}°`],
      ["Magnitude", d.magnitude.toFixed(1)],
      ...riseSetRows(d.ra, d.dec, observer, STD_ALT_STAR),
    ], altChart(d.ra, d.dec, observer));
  }
}
