// Bottom toolbar with icon buttons + a settings sheet. Consolidates what used to be
// seven scattered floating chips into one deliberate control surface.

export interface ToolbarApi {
  addButton(opts: { icon: string; label: string; onClick: () => void }): HTMLButtonElement;
  settingsBody: HTMLElement;
  openSettings(): void;
}

// The inner HTML for a toolbar button (icon over a small label). Exported so
// callers can re-render a button whose icon/label changes (e.g. Sky ↔ Map).
export function tbContent(iconSvg: string, label: string): string {
  return `${iconSvg}<span class="tb-label">${label}</span>`;
}

export function createToolbar(): ToolbarApi {
  const bar = document.createElement("div");
  bar.className = "toolbar";
  document.body.appendChild(bar);

  // Settings sheet + backdrop.
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  const sheet = document.createElement("div");
  sheet.className = "ui-panel sheet";
  const header = document.createElement("div");
  header.className = "sheet-title";
  header.textContent = "SETTINGS";
  const body = document.createElement("div");
  sheet.appendChild(header);
  sheet.appendChild(body);
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.classList.remove("show");
  });

  function addButton(opts: { icon: string; label: string; onClick: () => void }): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "tb-btn";
    btn.innerHTML = tbContent(opts.icon, opts.label);
    btn.addEventListener("click", opts.onClick);
    bar.appendChild(btn);
    return btn;
  }

  function openSettings(): void {
    backdrop.classList.toggle("show");
  }

  return { addButton, settingsBody: body, openSettings };
}
