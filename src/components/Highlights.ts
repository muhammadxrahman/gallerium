export interface HighlightItem {
  icon: string;
  text: string;
}

// "Tonight" panel: a compact feed of what's worth looking at. `getItems` is read
// fresh each time the panel opens so it reflects the current location/time.
export function initHighlights(getItems: () => HighlightItem[]): void {
  const btn = document.createElement("button");
  btn.id = "tonight-btn";
  btn.className = "ui-chip";
  btn.textContent = "✦ Tonight";
  btn.style.cssText = "position:fixed;top:112px;right:16px;z-index:200;";
  document.body.appendChild(btn);

  const panel = document.createElement("div");
  panel.className = "ui-panel";
  panel.style.cssText =
    "position:fixed;top:152px;right:16px;z-index:200;display:none;padding:14px 16px;width:min(320px,92vw);max-height:60vh;overflow-y:auto;";

  document.body.appendChild(panel);

  function render(): void {
    const items = getItems();
    const title = `<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:rgba(255,255,255,0.5);margin-bottom:12px">TONIGHT</div>`;
    const rows = items
      .map(
        (i) =>
          `<div style="display:flex;gap:10px;align-items:baseline;padding:5px 0;font-size:13px;color:rgba(255,255,255,0.88);line-height:1.4">
             <span style="width:18px;flex:none;text-align:center">${i.icon}</span><span>${i.text}</span>
           </div>`
      )
      .join("");
    panel.innerHTML = title + (rows || `<div style="color:rgba(255,255,255,0.5);font-size:13px">Nothing notable right now.</div>`);
  }

  btn.addEventListener("click", () => {
    if (panel.style.display === "none") {
      render();
      panel.style.display = "block";
    } else {
      panel.style.display = "none";
    }
  });
}
