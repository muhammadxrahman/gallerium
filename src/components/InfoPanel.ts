import { state } from "../store/state";
import { riseTransitSet, STD_ALT_STAR, STD_ALT_SUN } from "../astronomy/riseset";
import { moonPhaseName } from "../astronomy/moon";
import { getSkyTime } from "../utils/clock";
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
};

export function initInfoPanel(): void {
  panel = document.createElement("div");
  panel.id = "info-panel";
  document.body.appendChild(panel);
}

function card(type: string, name: string, stats: Array<[string, string]>): string {
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
    ]);
  } else if (obj.type === "planet") {
    const p = obj.data;
    panel.innerHTML = card("PLANET", p.name, [
      ["Altitude", `${p.alt.toFixed(1)}°`],
      ["Azimuth", `${p.az.toFixed(1)}°`],
      ["Magnitude", p.magnitude.toFixed(1)],
      ["Illumination", `${Math.round(p.phase * 100)}%`],
      ...riseSetRows(p.ra, p.dec, observer, STD_ALT_STAR),
    ]);
  } else if (obj.type === "sun") {
    const s = obj.data;
    panel.innerHTML = card("SUN", "Sun", [
      ["Altitude", `${s.alt.toFixed(1)}°`],
      ["Azimuth", `${s.az.toFixed(1)}°`],
      ...riseSetRows(s.ra, s.dec, observer, STD_ALT_SUN),
    ]);
  } else if (obj.type === "moon") {
    const m = obj.data;
    panel.innerHTML = card("MOON", "Moon", [
      ["Altitude", `${m.alt.toFixed(1)}°`],
      ["Azimuth", `${m.az.toFixed(1)}°`],
      ["Illumination", `${Math.round(m.illumination * 100)}%`],
      ["Phase", moonPhaseName(m.illumination, m.waxing)],
      ...riseSetRows(m.ra, m.dec, observer, STD_ALT_STAR),
    ]);
  } else if (obj.type === "satellite") {
    const s = obj.data;
    panel.innerHTML = card("SATELLITE", s.name, [
      ["Altitude", `${s.alt.toFixed(1)}°`],
      ["Azimuth", `${s.az.toFixed(1)}°`],
      ["Orbital height", `${s.altitude.toFixed(0)} km`],
    ]);
  }
}
