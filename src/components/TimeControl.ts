import { getSkyTime, isLive, setSkyTime, shiftSkyTime, goLive } from "../utils/clock";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Time-travel panel (opened from the toolbar): jump to any date/time, step by
// hour/day, or return to live. `onChange` fires on every change.
export function initTimeControl(onChange: () => void): { open: () => void } {
  const panel = document.createElement("div");
  panel.className = "ui-panel bottom-panel";

  const steps = document.createElement("div");
  steps.style.cssText = "display:flex;gap:6px;margin-bottom:10px;";
  const stepDefs: Array<[string, number]> = [
    ["−1d", -DAY],
    ["−1h", -HOUR],
    ["+1h", HOUR],
    ["+1d", DAY],
  ];
  for (const [label, delta] of stepDefs) {
    const b = document.createElement("button");
    b.className = "ui-chip";
    b.textContent = label;
    b.style.cssText = "flex:1;justify-content:center;padding:8px 0;";
    b.addEventListener("click", () => {
      shiftSkyTime(delta);
      sync();
      onChange();
    });
    steps.appendChild(b);
  }

  const input = document.createElement("input");
  input.type = "datetime-local";
  input.style.cssText =
    "width:100%;box-sizing:border-box;padding:8px 10px;margin-bottom:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:white;font-size:14px;color-scheme:dark;";
  input.addEventListener("change", () => {
    const d = new Date(input.value);
    if (!isNaN(d.getTime())) {
      setSkyTime(d);
      sync();
      onChange();
    }
  });

  const live = document.createElement("button");
  live.className = "ui-chip";
  live.textContent = "Now (Live)";
  live.style.cssText = "width:100%;justify-content:center;";
  live.addEventListener("click", () => {
    goLive();
    sync();
    onChange();
  });

  panel.appendChild(steps);
  panel.appendChild(input);
  panel.appendChild(live);
  document.body.appendChild(panel);

  function sync(): void {
    input.value = toLocalInput(getSkyTime());
    live.classList.toggle("ui-chip-active", isLive());
  }

  function open(): void {
    if (panel.classList.contains("show")) {
      panel.classList.remove("show");
      return;
    }
    // Only one bottom panel (Time / Tonight) open at a time.
    document.querySelectorAll(".bottom-panel.show").forEach((p) => p.classList.remove("show"));
    sync();
    panel.classList.add("show");
  }

  return { open };
}
