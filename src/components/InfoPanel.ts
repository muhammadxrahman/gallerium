import { state } from "../store/state";
import { riseTransitSet, STD_ALT_STAR, STD_ALT_SUN } from "../astronomy/riseset";
import { moonPhaseName } from "../astronomy/moon";
import { altitudeTrack, sunAltitudeTrack } from "../astronomy/altitudeTrack";
import { altitudeSparkline } from "./altitudeSparkline";
import { getSkyTime } from "../utils/clock";
import { formatRA, formatDec } from "../utils/coordFormat";
import { DEEP_SKY_KIND_LABEL } from "../data/deepSky";
import { metaFromSelection, metaToSearchId } from "../engine/search";
import { isFavorite, toggleFavorite } from "../store/favorites";
import { getLayers } from "./Layers";
import { icon } from "./icons";
import type { Observer } from "../astronomy/coordinates";

let panel: HTMLDivElement | null = null;
let lastHtml = ""; // diff guard: only touch the DOM when the card content actually changes
let suppressUntil = 0; // brief pause after a ★ toggle so its pop animation isn't clobbered

function clockStr(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// The first two stat rows: Alt/Az, or RA/Dec when the equatorial-coords setting is on.
function coordRows(o: { ra: number; dec: number; alt: number; az: number }): Array<[string, string]> {
  if (getLayers().equatorialCoords) {
    return [
      ["RA", formatRA(o.ra)],
      ["Dec", formatDec(o.dec)],
    ];
  }
  return [
    ["Altitude", `${o.alt.toFixed(1)}°`],
    ["Azimuth", `${o.az.toFixed(1)}°`],
  ];
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

  // Favorite (★) toggle, delegated. Mutate the live button (fill + label + a scale pop)
  // and pause card rebuilds briefly so the pop plays out instead of being destroyed by
  // the next frame's update.
  panel.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".fav-btn") as HTMLElement | null;
    const id = btn?.dataset.fav;
    if (!btn || !id) return;
    const nowFav = toggleFavorite(id);
    const label = nowFav ? "Remove from saved" : "Save to observing list";
    btn.classList.toggle("fav-on", nowFav);
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
    suppressUntil = performance.now() + 350;
    btn.animate?.(
      [{ transform: "scale(1)" }, { transform: "scale(1.4)" }, { transform: "scale(1)" }],
      { duration: 300, easing: "ease-out" }
    );
  });
}

// The favorite-toggle button for a card, or "" when the object can't be saved
// (satellites have no stable catalog id).
function favButton(favId: string | null): string {
  if (!favId) return "";
  const on = isFavorite(favId) ? " fav-on" : "";
  const label = isFavorite(favId) ? "Remove from saved" : "Save to observing list";
  return `<button class="fav-btn${on}" data-fav="${favId}" aria-label="${label}" title="${label}">${icon("star", 18)}</button>`;
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

function card(
  type: string,
  name: string,
  stats: Array<[string, string]>,
  chart = "",
  favId: string | null = null
): string {
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
      ${favButton(favId)}
    </div>
    <div class="info-stats">${rows}</div>
    ${chart}
  `;
}

export function updateInfoPanel(observer: Observer | null = null): void {
  if (!panel) return;
  // Hold off rebuilding for a moment after a favorite toggle so the ★ pop completes.
  if (performance.now() < suppressUntil) return;

  const obj = state.selected;
  if (!obj) {
    panel.classList.remove("show");
    lastHtml = "";
    return;
  }
  panel.classList.add("show");

  // The search-index id used to favorite this object (null for satellites / points).
  const meta = metaFromSelection(obj);
  const favId = meta ? metaToSearchId(meta) : null;

  let html = "";
  if (obj.type === "star") {
    const s = obj.data;
    html = card("STAR", s.name ?? `Star #${s.id}`, [
      ...coordRows(s),
      ["Magnitude", s.magnitude.toFixed(2)],
      ["Color index", s.colorIndex.toFixed(2)],
      ...riseSetRows(s.ra, s.dec, observer, STD_ALT_STAR),
    ], altChart(s.ra, s.dec, observer), favId);
  } else if (obj.type === "planet") {
    const p = obj.data;
    html = card("PLANET", p.name, [
      ...coordRows(p),
      ["Magnitude", p.magnitude.toFixed(1)],
      ["Illumination", `${Math.round(p.phase * 100)}%`],
      ...riseSetRows(p.ra, p.dec, observer, STD_ALT_STAR),
    ], altChart(p.ra, p.dec, observer), favId);
  } else if (obj.type === "sun") {
    const s = obj.data;
    html = card("SUN", "Sun", [
      ...coordRows(s),
      ...riseSetRows(s.ra, s.dec, observer, STD_ALT_SUN),
    ], altChart(s.ra, s.dec, observer), favId);
  } else if (obj.type === "moon") {
    const m = obj.data;
    html = card("MOON", "Moon", [
      ...coordRows(m),
      ["Illumination", `${Math.round(m.illumination * 100)}%`],
      ["Phase", moonPhaseName(m.illumination, m.waxing)],
      ...riseSetRows(m.ra, m.dec, observer, STD_ALT_STAR),
    ], altChart(m.ra, m.dec, observer), favId);
  } else if (obj.type === "satellite") {
    const s = obj.data;
    html = card("SATELLITE", s.name, [
      ["Altitude", `${s.alt.toFixed(1)}°`],
      ["Azimuth", `${s.az.toFixed(1)}°`],
      ["Orbital height", `${s.altitude.toFixed(0)} km`],
    ]);
  } else if (obj.type === "deepsky") {
    const d = obj.data;
    html = card("DEEP SKY", d.name === d.id ? d.id : `${d.name} (${d.id})`, [
      ["Type", DEEP_SKY_KIND_LABEL[d.kind]],
      ...coordRows(d),
      ["Magnitude", d.magnitude.toFixed(1)],
      ...riseSetRows(d.ra, d.dec, observer, STD_ALT_STAR),
    ], altChart(d.ra, d.dec, observer), favId);
  }

  // Only touch the DOM when the rendered content actually changed — this stops the panel
  // rebuilding every frame (it's called from draw()), which would otherwise kill the ★
  // pop and waste work.
  if (html && html !== lastHtml) {
    panel.innerHTML = html;
    lastHtml = html;
  }
}
