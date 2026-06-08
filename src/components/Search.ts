export interface SearchItem {
  id: string;
  label: string;
  sublabel: string;
}

// A search control opened from the toolbar: type to filter the object list, pick a
// result to be guided to it. `getItems` is read fresh each open (the catalog grows
// after data loads); `onSelect` receives the chosen item's id. Returns `{ open }`.
export function initSearch(
  getItems: () => SearchItem[],
  onSelect: (id: string) => void
): { open: () => void } {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.style.alignItems = "flex-start"; // search sits near the top

  const box = document.createElement("div");
  box.className = "ui-panel";
  box.style.cssText = "margin-top:14vh;padding:12px;width:min(360px,92vw);";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Find a star, planet, constellation…";
  input.style.cssText =
    "width:100%;box-sizing:border-box;padding:10px 12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:9px;color:white;font-size:15px;";

  const list = document.createElement("div");
  list.style.cssText = "margin-top:8px;max-height:46vh;overflow-y:auto;";

  box.appendChild(input);
  box.appendChild(list);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function close(): void {
    overlay.classList.remove("show");
  }

  function render(items: SearchItem[]): void {
    const q = input.value.trim().toLowerCase();
    const matches = (q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items).slice(0, 30);
    list.innerHTML = "";
    if (matches.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "padding:12px;color:rgba(255,255,255,0.5);font-size:13px;";
      empty.textContent = q ? "No matches" : "Type to search";
      list.appendChild(empty);
      return;
    }
    for (const item of matches) {
      const row = document.createElement("button");
      row.className = "ui-row";
      row.style.cssText =
        "width:100%;text-align:left;background:none;border:none;cursor:pointer;display:flex;justify-content:space-between;gap:12px;";
      row.innerHTML = `<span style="color:#fff">${item.label}</span><span style="color:rgba(255,255,255,0.45);font-size:12px">${item.sublabel}</span>`;
      row.addEventListener("click", () => {
        onSelect(item.id);
        close();
      });
      list.appendChild(row);
    }
  }

  let items: SearchItem[] = [];
  input.addEventListener("input", () => render(items));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  function open(): void {
    items = getItems();
    input.value = "";
    render(items);
    overlay.classList.add("show");
    input.focus();
  }

  return { open };
}
