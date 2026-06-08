import { requestLocation, type Location } from "../utils/geo";

interface LocationControlOptions {
  getCurrent: () => Location | null;
  onChange: (loc: Location) => void;
}

function isValidLat(n: number): boolean {
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

function isValidLon(n: number): boolean {
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

// A manual location control so users can view the sky for any place on Earth,
// recover from a denied geolocation prompt, or correct a stale cached fix.
export function initLocationControl(opts: LocationControlOptions): void {
  const btn = document.createElement("button");
  btn.id = "location-btn";
  btn.textContent = "📍 Location";
  btn.style.cssText = `
    position: fixed;
    top: 16px;
    left: 16px;
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
  document.body.appendChild(btn);

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.6);
    z-index: 300;
  `;

  const panel = document.createElement("div");
  panel.style.cssText = `
    background: rgba(10,10,20,0.95);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 14px;
    padding: 20px;
    width: min(320px, 90vw);
    color: white;
    font-family: sans-serif;
    backdrop-filter: blur(8px);
  `;

  const inputStyle = `
    width: 100%;
    box-sizing: border-box;
    margin-top: 4px;
    margin-bottom: 12px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px;
    color: white;
    font-size: 14px;
  `;

  panel.innerHTML = `
    <div style="font-size:16px;font-weight:bold;margin-bottom:14px">Set your location</div>
    <label style="font-size:12px;color:rgba(255,255,255,0.6)">Latitude (-90 to 90)
      <input id="loc-lat" type="number" step="any" inputmode="decimal" style="${inputStyle}" />
    </label>
    <label style="font-size:12px;color:rgba(255,255,255,0.6)">Longitude (-180 to 180)
      <input id="loc-lon" type="number" step="any" inputmode="decimal" style="${inputStyle}" />
    </label>
    <div id="loc-error" style="color:#ff8080;font-size:12px;min-height:16px;margin-bottom:8px"></div>
    <button id="loc-gps" style="width:100%;padding:9px;margin-bottom:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:white;font-size:13px;cursor:pointer">Use my current location</button>
    <div style="display:flex;gap:8px">
      <button id="loc-cancel" style="flex:1;padding:9px;background:transparent;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:white;font-size:13px;cursor:pointer">Cancel</button>
      <button id="loc-save" style="flex:1;padding:9px;background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.4);border-radius:8px;color:white;font-size:13px;cursor:pointer">Save</button>
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const latInput = panel.querySelector("#loc-lat") as HTMLInputElement;
  const lonInput = panel.querySelector("#loc-lon") as HTMLInputElement;
  const errorEl = panel.querySelector("#loc-error") as HTMLDivElement;
  const gpsBtn = panel.querySelector("#loc-gps") as HTMLButtonElement;
  const cancelBtn = panel.querySelector("#loc-cancel") as HTMLButtonElement;
  const saveBtn = panel.querySelector("#loc-save") as HTMLButtonElement;

  function open() {
    const cur = opts.getCurrent();
    latInput.value = cur ? String(cur.latitude) : "";
    lonInput.value = cur ? String(cur.longitude) : "";
    errorEl.textContent = "";
    overlay.style.display = "flex";
  }

  function close() {
    overlay.style.display = "none";
  }

  btn.addEventListener("click", open);
  cancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  saveBtn.addEventListener("click", () => {
    const lat = parseFloat(latInput.value);
    const lon = parseFloat(lonInput.value);
    if (!isValidLat(lat) || !isValidLon(lon)) {
      errorEl.textContent = "Enter a valid latitude and longitude.";
      return;
    }
    opts.onChange({ latitude: lat, longitude: lon });
    close();
  });

  gpsBtn.addEventListener("click", async () => {
    errorEl.textContent = "";
    gpsBtn.textContent = "Locating…";
    gpsBtn.disabled = true;
    try {
      const loc = await requestLocation();
      latInput.value = String(loc.latitude);
      lonInput.value = String(loc.longitude);
      opts.onChange(loc);
      close();
    } catch {
      errorEl.textContent = "Couldn't get your location. Enter it manually.";
    } finally {
      gpsBtn.textContent = "Use my current location";
      gpsBtn.disabled = false;
    }
  });
}
