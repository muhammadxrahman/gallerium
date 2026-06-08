export interface LayerState {
  daylight: boolean;
  constellations: boolean;
  constellationNames: boolean;
  grid: boolean;
  ecliptic: boolean;
  milkyway: boolean;
}

const DEFAULTS: LayerState = {
  daylight: true,
  constellations: true,
  constellationNames: true,
  grid: false,
  ecliptic: true,
  milkyway: true,
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

// Update a single layer and persist. Used by standalone toggles (e.g. day/night).
export function setLayer(key: keyof LayerState, value: boolean): void {
  state[key] = value;
  save();
}

// "daylight" is surfaced as its own prominent button (see main.ts), not in the panel.
const ROWS: Array<{ key: keyof LayerState; label: string }> = [
  { key: "constellations", label: "Constellations" },
  { key: "constellationNames", label: "Constellation names" },
  { key: "milkyway", label: "Milky Way" },
  { key: "ecliptic", label: "Ecliptic" },
  { key: "grid", label: "Equatorial grid" },
];

// A small "Layers" button that opens a panel of toggles. onChange fires on any
// change so the caller can request a redraw.
export function initLayersControl(onChange: () => void): void {
  const btn = document.createElement("button");
  btn.id = "layers-btn";
  btn.className = "ui-chip";
  btn.textContent = "☰ Layers";
  btn.style.cssText = "position:fixed;top:64px;right:16px;z-index:200;";
  document.body.appendChild(btn);

  const panel = document.createElement("div");
  panel.className = "ui-panel";
  panel.style.cssText =
    "position:fixed;top:104px;right:16px;z-index:200;display:none;padding:8px;min-width:200px;";

  for (const { key, label } of ROWS) {
    const row = document.createElement("label");
    row.style.cssText =
      "display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;cursor:pointer;font-size:13px;color:rgba(255,255,255,0.85);";
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
    panel.appendChild(row);
  }

  document.body.appendChild(panel);

  btn.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
}
