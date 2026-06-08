import { state } from "../store/state";

let panel: HTMLDivElement | null = null;

// Human-readable Moon phase from illuminated fraction + waxing/waning direction.
function moonPhaseName(illumination: number, waxing: boolean): string {
  if (illumination < 0.04) return "New Moon";
  if (illumination > 0.96) return "Full Moon";
  if (illumination > 0.46 && illumination < 0.54) {
    return waxing ? "First Quarter" : "Last Quarter";
  }
  const shape = illumination < 0.5 ? "Crescent" : "Gibbous";
  return `${waxing ? "Waxing" : "Waning"} ${shape}`;
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

export function updateInfoPanel(): void {
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
    ]);
  } else if (obj.type === "planet") {
    const p = obj.data;
    panel.innerHTML = card("PLANET", p.name, [
      ["Altitude", `${p.alt.toFixed(1)}°`],
      ["Azimuth", `${p.az.toFixed(1)}°`],
    ]);
  } else if (obj.type === "sun") {
    const s = obj.data;
    panel.innerHTML = card("SUN", "Sun", [
      ["Altitude", `${s.alt.toFixed(1)}°`],
      ["Azimuth", `${s.az.toFixed(1)}°`],
    ]);
  } else if (obj.type === "moon") {
    const m = obj.data;
    panel.innerHTML = card("MOON", "Moon", [
      ["Altitude", `${m.alt.toFixed(1)}°`],
      ["Azimuth", `${m.az.toFixed(1)}°`],
      ["Illumination", `${Math.round(m.illumination * 100)}%`],
      ["Phase", moonPhaseName(m.illumination, m.waxing)],
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
