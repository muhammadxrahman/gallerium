import type { TargetMeta } from "../engine/search";

export interface HighlightItem {
  icon: string; // an SVG string (see icons.ts)
  text: string;
  target?: TargetMeta; // if present, the row is tappable → guide to this object
}

// "Tonight" panel (opened from the toolbar): a compact feed of what's worth looking
// at. `getItems` is read fresh each open so it reflects the current location/time.
// `onSelect` is called with a row's target when a tappable row is tapped.
export function initHighlights(
  getItems: () => HighlightItem[],
  onSelect: (target: TargetMeta) => void
): { open: () => void } {
  const panel = document.createElement("div");
  panel.className = "ui-panel bottom-panel";
  panel.style.maxHeight = "60vh";
  panel.style.overflowY = "auto";
  document.body.appendChild(panel);

  let items: HighlightItem[] = [];

  function render(): void {
    items = getItems();
    const title = `<div class="sheet-title">TONIGHT</div>`;
    const rows = items
      .map((i, idx) => {
        const inner = `<span class="hl-icon">${i.icon}</span><span>${i.text}</span>`;
        // Tappable rows (those with a target) render as buttons that guide there.
        return i.target
          ? `<button class="hl-row hl-tappable" data-idx="${idx}">${inner}</button>`
          : `<div class="hl-row">${inner}</div>`;
      })
      .join("");
    panel.innerHTML =
      title +
      (rows || `<div style="color:rgba(255,255,255,0.5);font-size:13px">Nothing notable right now.</div>`);
  }

  // Delegate clicks: a tapped row guides to its target and closes the panel.
  panel.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".hl-tappable") as HTMLElement | null;
    if (!btn) return;
    const item = items[Number(btn.dataset.idx)];
    if (item?.target) {
      panel.classList.remove("show");
      onSelect(item.target);
    }
  });

  function open(): void {
    if (panel.classList.contains("show")) {
      panel.classList.remove("show");
      return;
    }
    document.querySelectorAll(".bottom-panel.show").forEach((p) => p.classList.remove("show"));
    render();
    panel.classList.add("show");
  }

  return { open };
}
