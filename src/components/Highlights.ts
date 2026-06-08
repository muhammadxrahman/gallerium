export interface HighlightItem {
  icon: string; // an SVG string (see icons.ts)
  text: string;
}

// "Tonight" panel (opened from the toolbar): a compact feed of what's worth looking
// at. `getItems` is read fresh each open so it reflects the current location/time.
export function initHighlights(getItems: () => HighlightItem[]): { open: () => void } {
  const panel = document.createElement("div");
  panel.className = "ui-panel bottom-panel";
  panel.style.cssText += "max-height:60vh;overflow-y:auto;";
  panel.style.display = "none";
  document.body.appendChild(panel);

  function render(): void {
    const items = getItems();
    const title = `<div class="sheet-title">TONIGHT</div>`;
    const rows = items
      .map(
        (i) =>
          `<div class="hl-row"><span class="hl-icon">${i.icon}</span><span>${i.text}</span></div>`
      )
      .join("");
    panel.innerHTML =
      title +
      (rows || `<div style="color:rgba(255,255,255,0.5);font-size:13px">Nothing notable right now.</div>`);
  }

  function open(): void {
    if (panel.style.display === "none") {
      render();
      panel.style.display = "block";
    } else {
      panel.style.display = "none";
    }
  }

  return { open };
}
