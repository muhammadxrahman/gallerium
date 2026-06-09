import { bortleLevel, DEFAULT_BORTLE } from "../utils/bortle";

export interface LayerState {
  nightVision: boolean; // red palette to preserve dark adaptation
  daylight: boolean;
  constellations: boolean;
  constellationNames: boolean;
  grid: boolean;
  ecliptic: boolean;
  milkyway: boolean;
  deepSky: boolean;
  bortle: number; // light-pollution class 1..9 (drives magnitudeLimit + Milky Way)
  magnitudeLimit: number; // derived from bortle; the limit renderStars actually uses
}

type BoolKey = Exclude<keyof LayerState, "magnitudeLimit" | "bortle">;

const DEFAULTS: LayerState = {
  nightVision: false,
  daylight: true,
  constellations: true,
  constellationNames: true,
  grid: false,
  ecliptic: true,
  milkyway: true,
  deepSky: true,
  bortle: DEFAULT_BORTLE,
  magnitudeLimit: bortleLevel(DEFAULT_BORTLE).limitMag,
};

const KEY = "gallerium-layers";

let state: LayerState = load();

function load(): LayerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function getLayers(): LayerState {
  return state;
}

// Update a boolean layer and persist. Used by standalone toggles (e.g. day/night).
export function setLayer(key: BoolKey, value: boolean): void {
  state[key] = value;
  save();
}

// Set the light-pollution (Bortle) class. Drives the limiting magnitude renderStars uses
// and the Milky Way visibility (read via bortleLevel in the draw loop).
export function setBortle(cls: number): void {
  const level = bortleLevel(cls);
  state.bortle = level.class;
  state.magnitudeLimit = level.limitMag;
  save();
}

const ROWS: Array<{ key: BoolKey; label: string }> = [
  { key: "nightVision", label: "Night vision (red)" },
  { key: "daylight", label: "Daylight sky" },
  { key: "constellations", label: "Constellations" },
  { key: "constellationNames", label: "Constellation names" },
  { key: "deepSky", label: "Deep-sky objects" },
  { key: "milkyway", label: "Milky Way" },
  { key: "ecliptic", label: "Ecliptic" },
  { key: "grid", label: "Grid & meridian" },
];

// Build the layer toggles + star-density slider into `container` (the settings
// sheet). `onChange` fires on any change so the caller can request a redraw.
export function buildLayersControls(container: HTMLElement, onChange: () => void): void {
  for (const { key, label } of ROWS) {
    const row = document.createElement("label");
    row.className = "ui-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = state[key];
    cb.addEventListener("change", () => {
      state[key] = cb.checked;
      save();
      onChange();
    });
    const text = document.createElement("span");
    text.textContent = label;
    row.appendChild(cb);
    row.appendChild(text);
    container.appendChild(row);
  }

  // Light-pollution (Bortle) selector — "where are you observing from". Drives how many
  // stars show and how visible the Milky Way is, matching what you'd actually see.
  const sliderWrap = document.createElement("div");
  sliderWrap.style.cssText = "padding:12px 8px 4px;";
  const sliderLabel = document.createElement("div");
  sliderLabel.style.cssText =
    "font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px;display:flex;justify-content:space-between;gap:8px;";
  const updateLabel = () => {
    const lv = bortleLevel(state.bortle);
    sliderLabel.innerHTML = `<span>Light pollution</span><span style="color:rgba(255,255,255,0.85)">Bortle ${lv.class} · ${lv.label}</span>`;
  };
  updateLabel();
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "1";
  slider.max = "9";
  slider.step = "1";
  slider.value = String(state.bortle);
  slider.style.cssText = "width:100%;";
  slider.addEventListener("input", () => {
    setBortle(parseInt(slider.value, 10));
    updateLabel();
    onChange();
  });
  sliderWrap.appendChild(sliderLabel);
  sliderWrap.appendChild(slider);
  container.appendChild(sliderWrap);
}
