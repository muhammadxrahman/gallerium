export interface LayerState {
  daylight: boolean;
  constellations: boolean;
  constellationNames: boolean;
  grid: boolean;
  ecliptic: boolean;
  milkyway: boolean;
  magnitudeLimit: number; // hide stars fainter than this (light-pollution control)
}

type BoolKey = Exclude<keyof LayerState, "magnitudeLimit">;

const DEFAULTS: LayerState = {
  daylight: true,
  constellations: true,
  constellationNames: true,
  grid: false,
  ecliptic: true,
  milkyway: true,
  magnitudeLimit: 6.5,
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

export function setMagnitudeLimit(value: number): void {
  state.magnitudeLimit = value;
  save();
}

const ROWS: Array<{ key: BoolKey; label: string }> = [
  { key: "daylight", label: "Daylight sky" },
  { key: "constellations", label: "Constellations" },
  { key: "constellationNames", label: "Constellation names" },
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

  // Star-density / limiting-magnitude slider.
  const sliderWrap = document.createElement("div");
  sliderWrap.style.cssText = "padding:12px 8px 4px;";
  const sliderLabel = document.createElement("div");
  sliderLabel.style.cssText =
    "font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px;display:flex;justify-content:space-between;";
  const updateLabel = () => {
    sliderLabel.innerHTML = `<span>Star density</span><span style="color:rgba(255,255,255,0.85)">mag ≤ ${state.magnitudeLimit.toFixed(1)}</span>`;
  };
  updateLabel();
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "3";
  slider.max = "6.5";
  slider.step = "0.5";
  slider.value = String(state.magnitudeLimit);
  slider.style.cssText = "width:100%;";
  slider.addEventListener("input", () => {
    setMagnitudeLimit(parseFloat(slider.value));
    updateLabel();
    onChange();
  });
  sliderWrap.appendChild(sliderLabel);
  sliderWrap.appendChild(slider);
  container.appendChild(sliderWrap);
}
