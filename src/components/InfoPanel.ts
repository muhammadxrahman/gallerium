import { state } from "../store/state";

let panel: HTMLDivElement | null = null;

export function initInfoPanel(): void {
  panel = document.createElement("div");
  panel.id = "info-panel";
  panel.style.cssText = `
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 12px;
    padding: 14px 20px;
    color: white;
    font-family: sans-serif;
    font-size: 13px;
    min-width: 220px;
    max-width: 320px;
    display: none;
    pointer-events: auto;
    backdrop-filter: blur(8px);
    z-index: 100;
  `;
  document.body.appendChild(panel);
}

export function updateInfoPanel(): void {
  if (!panel) return;
  const obj = state.selected;

  if (!obj) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "block";

  if (obj.type === "star") {
    const s = obj.data;
    panel.innerHTML = `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <span style="font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);letter-spacing:0.5px">STAR</span>
    <div style="font-size:15px;font-weight:bold">${s.name ?? `Star #${s.id}`}</div>
  </div>
  <div style="color:rgba(255,255,255,0.6);line-height:1.8">
    Altitude: ${s.alt.toFixed(1)}°<br>
    Azimuth: ${s.az.toFixed(1)}°<br>
    Magnitude: ${s.magnitude.toFixed(2)}<br>
    Color index: ${s.colorIndex.toFixed(2)}
  </div>
`;
  } else if (obj.type === "planet") {
    const p = obj.data;
    panel.innerHTML = `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <span style="font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);letter-spacing:0.5px">PLANET</span>
    <div style="font-size:15px;font-weight:bold">${p.name}</div>
  </div>
  <div style="color:rgba(255,255,255,0.6);line-height:1.8">
    Altitude: ${p.alt.toFixed(1)}°<br>
    Azimuth: ${p.az.toFixed(1)}°
  </div>
    `;
  } else if (obj.type === "satellite") {
    const s = obj.data;
    panel.innerHTML = `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <span style="font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);letter-spacing:0.5px">SATELLITE</span>
    <div style="font-size:15px;font-weight:bold">${s.name}</div>
  </div>
  <div style="color:rgba(255,255,255,0.6);line-height:1.8">
    Altitude: ${s.alt.toFixed(1)}°<br>
    Azimuth: ${s.az.toFixed(1)}°<br>
    Orbital height: ${s.altitude.toFixed(0)} km
  </div>
    `;
  }
}