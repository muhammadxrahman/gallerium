// A small, consistent line-icon set (single-stroke, currentColor) used across the
// UI. Replaces emoji, which render differently on every platform and look amateur.

const PATHS: Record<string, string> = {
  search: `<circle cx="11" cy="11" r="7"/><line x1="20.5" y1="20.5" x2="16" y2="16"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><polyline points="12 6.5 12 12 15.5 14"/>`,
  // Targeting reticle = "point at the sky" (AR).
  sky: `<circle cx="12" cy="12" r="5"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>`,
  // Globe/dome = "back to map".
  map: `<circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3c3 3 3 15 0 18c-3-3-3-15 0-18z"/>`,
  star: `<polygon points="12 3 14.2 9 20.5 9.2 15.5 13.2 17.3 19.3 12 15.6 6.7 19.3 8.5 13.2 3.5 9.2 9.8 9"/>`,
  sliders: `<line x1="4" y1="8" x2="20" y2="8"/><circle cx="9" cy="8" r="2.2"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="15" cy="16" r="2.2"/>`,
  pin: `<path d="M12 21s6.5-5.8 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.2 12 21 12 21z"/><circle cx="12" cy="10" r="2.4"/>`,
  refresh: `<path d="M20 11a8 8 0 1 0-.6 4"/><polyline points="20 4 20 9 15 9"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><line x1="12" y1="2.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21.5" y2="12"/><line x1="5.2" y1="5.2" x2="6.8" y2="6.8"/><line x1="17.2" y1="17.2" x2="18.8" y2="18.8"/><line x1="5.2" y1="18.8" x2="6.8" y2="17.2"/><line x1="17.2" y1="6.8" x2="18.8" y2="5.2"/>`,
  moon: `<path d="M20 13.5A8 8 0 1 1 10.5 4a6.3 6.3 0 0 0 9.5 9.5z"/>`,
  planet: `<circle cx="12" cy="12" r="4.5"/><ellipse cx="12" cy="12" rx="9" ry="3" transform="rotate(-22 12 12)"/>`,
  satellite: `<circle cx="12" cy="12" r="1.7"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(28 12 12)"/>`,
  conjunction: `<circle cx="9" cy="12" r="4.3"/><circle cx="15.5" cy="12" r="3.4"/>`,
  // Question mark in a circle = "help / tour".
  help: `<circle cx="12" cy="12" r="9"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.3-2.7 4"/><line x1="12" y1="17.4" x2="12" y2="17.5"/>`,
  close: `<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>`,
  // Four-way arrows = "drag / zoom / move around".
  move: `<line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/><polyline points="8.5 6.5 12 3 15.5 6.5"/><polyline points="8.5 17.5 12 21 15.5 17.5"/><polyline points="6.5 8.5 3 12 6.5 15.5"/><polyline points="17.5 8.5 21 12 17.5 15.5"/>`,
};

// The set of available icon names — used to validate references (e.g. the tour steps).
export const ICON_NAMES = Object.keys(PATHS);

export function icon(name: string, size = 22): string {
  const inner = PATHS[name] ?? "";
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
