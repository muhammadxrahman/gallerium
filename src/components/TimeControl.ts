import { getSkyTime, isLive, setSkyTime, shiftSkyTime, goLive } from "../utils/clock";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Local "YYYY-MM-DDTHH:mm" for a datetime-local input.
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// A time-travel control: jump to any date/time to see the sky then, or return to live.
export function initTimeControl(onChange: () => void): void {
  const chip = document.createElement("button");
  chip.id = "time-btn";
  chip.className = "ui-chip";
  chip.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:200;";
  document.body.appendChild(chip);

  const panel = document.createElement("div");
  panel.className = "ui-panel";
  panel.style.cssText =
    "position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:200;display:none;padding:12px;width:min(300px,92vw);";

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
  live.textContent = "● Now (Live)";
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
    const t = getSkyTime();
    chip.textContent = isLive()
      ? "🕐 Live"
      : "🕐 " +
        t.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    chip.classList.toggle("ui-chip-active", !isLive());
    input.value = toLocalInput(t);
  }

  chip.addEventListener("click", () => {
    sync(); // refresh the input to the current sky time when opening
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });

  sync();
}
