// A replayable, plain-language feature tour. It explains what each toolbar button does
// and what the app can do, one card at a time. It is NOT a first-run-only thing —
// `initTour()` returns an `open()` handle wired to a "Take a tour" button in the
// settings sheet, so the user can replay it whenever they want.

import { icon } from "./icons";

export interface TourStep {
  icon: string; // an icon name from icons.ts (validated by a test)
  title: string;
  body: string;
}

// Kept deliberately simple and jargon-free. Order roughly follows the toolbar
// (Search · Time · Sky/Map · Tonight · Settings), then the gestures.
export const TOUR_STEPS: TourStep[] = [
  {
    icon: "help",
    title: "Welcome to Gallerium",
    body: "Gallerium shows you the real night sky from where you are. Hold your phone up to find what's above you, or explore the whole sky on the map. Here's what each button does.",
  },
  {
    icon: "search",
    title: "Search",
    body: "Looking for something? Search for any star, planet, or constellation and Gallerium will guide you straight to it.",
  },
  {
    icon: "clock",
    title: "Time travel",
    body: "See the sky at any moment. Jump ahead to tonight or any future date, or rewind to the past. Tap “Live” to snap back to right now.",
  },
  {
    icon: "sky",
    title: "Sky & Map views",
    body: "Map view shows the whole sky as a dome. Sky view uses your phone's motion — point it anywhere and see exactly what's in that direction.",
  },
  {
    icon: "star",
    title: "Tonight",
    body: "A quick list of what's worth looking for tonight: sunset and dark-sky times, the Moon's phase, which planets are up, and the next Space Station flyover.",
  },
  {
    icon: "sliders",
    title: "Settings",
    body: "Show or hide constellations, the Milky Way, and deep-sky objects; switch on a red night-vision mode; match your light pollution so the sky looks like your real one; set your location; or share and save the view.",
  },
  {
    icon: "pin",
    title: "Tap to identify",
    body: "Tap any object to see its name and details. It stays locked on and follows that object as time moves, so you never lose track of it.",
  },
  {
    icon: "move",
    title: "Zoom & move around",
    body: "Pinch or scroll to zoom in for a closer look, and drag to pan around. Once you've zoomed in, a Reset button appears in the top-left corner to snap back (on a computer you can also double-click).",
  },
  {
    icon: "sky",
    title: "You're all set",
    body: "Tap anything in the sky to start exploring. You can reopen this tour any time with the question-mark button in the top corner.",
  },
];

// Clamp a step index into range — keeps Back/Next from running off either end.
export function clampStep(index: number, total: number): number {
  return Math.max(0, Math.min(total - 1, index));
}

export function initTour(): { open: () => void } {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  const card = document.createElement("div");
  card.className = "ui-panel tour-card";
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  let i = 0;

  function close(): void {
    overlay.classList.remove("show");
  }

  function go(delta: number): void {
    i = clampStep(i + delta, TOUR_STEPS.length);
    render();
  }

  function render(): void {
    const step = TOUR_STEPS[i];
    const last = i === TOUR_STEPS.length - 1;
    const dots = TOUR_STEPS.map((_, k) => `<span class="tour-dot${k === i ? " on" : ""}"></span>`).join("");

    card.innerHTML = `
      <button class="tour-skip" aria-label="Close tour">${icon("close", 18)}</button>
      <div class="tour-icon">${icon(step.icon, 28)}</div>
      <div class="tour-title">${step.title}</div>
      <div class="tour-body">${step.body}</div>
      <div class="tour-dots">${dots}</div>
      <div class="tour-nav">
        <button class="ui-chip tour-back"${i === 0 ? " disabled" : ""}>Back</button>
        <button class="ui-chip tour-next">${last ? "Done" : "Next"}</button>
      </div>
    `;
    card.querySelector(".tour-skip")!.addEventListener("click", close);
    card.querySelector(".tour-back")!.addEventListener("click", () => go(-1));
    card.querySelector(".tour-next")!.addEventListener("click", () => (last ? close() : go(1)));
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  function open(): void {
    i = 0;
    render();
    overlay.classList.add("show");
  }

  return { open };
}
