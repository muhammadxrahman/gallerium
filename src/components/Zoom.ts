// Shared view transform (zoom + pan) driven by wheel, mouse-drag, and touch.
// Map view applies it to the dome (radius *= zoom, center += pan); sky view only
// uses the zoom factor (FOV /= zoom). Zoom is anchored at the cursor/pinch point
// so you can zoom into any region, not just the center.

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

let zoom = 1;
let panX = 0;
let panY = 0;
let gestureEndedAt = 0;
let viewVersion = 0; // bumps on any zoom/pan change so the render loop redraws

// pinch state
let pinching = false;
let pinchStartDist = 0;
let pinchStartZoom = 1;
let pinchPrevX = 0;
let pinchPrevY = 0;

// drag state (mouse button or single finger)
let dragging = false;
let dragPrevX = 0;
let dragPrevY = 0;
let dragMoved = 0;

export function getZoom(): number {
  return zoom;
}

export function getPan(): { x: number; y: number } {
  return { x: panX, y: panY };
}

// Monotonic counter the render loop polls to detect zoom/pan changes.
export function getViewVersion(): number {
  return viewVersion;
}

// True while a pan/pinch is active or just ended — lets the tap/click handler
// ignore the pointer-up that ends a drag so it isn't treated as a selection.
export function recentlyInteracted(): boolean {
  return pinching || dragging || Date.now() - gestureEndedAt < 250;
}

export function resetView(): void {
  zoom = 1;
  panX = 0;
  panY = 0;
  viewVersion++;
}

// Center the view on a base (zoom=1, pan=0) screen point `(tx,ty)` at zoom `z`.
// Solves x' = cx + panX + z·(tx − cx) = cx ⇒ panX = −z·(tx − cx). Used by "guide me
// there" to bring a searched object to the middle of the dome.
export function centerOn(tx: number, ty: number, cx: number, cy: number, z = 2.5): void {
  zoom = clamp(z);
  panX = -zoom * (tx - cx);
  panY = -zoom * (ty - cy);
  viewVersion++;
}

function clamp(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

function touchDist(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function initZoom(canvas: HTMLCanvasElement): void {
  // Scale toward a screen point (canvas-local px), keeping the world under it fixed.
  const zoomAround = (sx: number, sy: number, targetZoom: number) => {
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const nz = clamp(targetZoom);
    const k = nz / zoom;
    panX = (sx - cx) * (1 - k) + k * panX;
    panY = (sy - cy) * (1 - k) + k * panY;
    zoom = nz;
    viewVersion++;
  };

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAround(e.clientX - rect.left, e.clientY - rect.top, zoom * Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false }
  );

  canvas.addEventListener("dblclick", (e) => {
    e.preventDefault();
    resetView();
  });

  // --- Mouse drag to pan ---
  canvas.addEventListener("mousedown", (e) => {
    dragging = true;
    dragPrevX = e.clientX;
    dragPrevY = e.clientY;
    dragMoved = 0;
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    panX += e.clientX - dragPrevX;
    panY += e.clientY - dragPrevY;
    dragMoved += Math.abs(e.clientX - dragPrevX) + Math.abs(e.clientY - dragPrevY);
    dragPrevX = e.clientX;
    dragPrevY = e.clientY;
    viewVersion++;
  });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    if (dragMoved > 5) gestureEndedAt = Date.now(); // suppress the click after a drag
  });

  // --- Touch: pinch to zoom, single finger to pan ---
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        pinching = true;
        pinchStartDist = touchDist(e.touches[0], e.touches[1]);
        pinchStartZoom = zoom;
        pinchPrevX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        pinchPrevY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      } else if (e.touches.length === 1) {
        dragging = true;
        dragPrevX = e.touches[0].clientX;
        dragPrevY = e.touches[0].clientY;
        dragMoved = 0;
      }
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (pinching && e.touches.length === 2) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const d = touchDist(e.touches[0], e.touches[1]);
        if (pinchStartDist > 0) {
          zoomAround(midX - rect.left, midY - rect.top, pinchStartZoom * (d / pinchStartDist));
        }
        // pan with the midpoint as the fingers slide across the screen
        panX += midX - pinchPrevX;
        panY += midY - pinchPrevY;
        pinchPrevX = midX;
        pinchPrevY = midY;
        viewVersion++;
      } else if (dragging && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        panX += t.clientX - dragPrevX;
        panY += t.clientY - dragPrevY;
        dragMoved += Math.abs(t.clientX - dragPrevX) + Math.abs(t.clientY - dragPrevY);
        dragPrevX = t.clientX;
        dragPrevY = t.clientY;
        viewVersion++;
      }
    },
    { passive: false }
  );

  const endTouch = (e: TouchEvent) => {
    if (pinching && e.touches.length < 2) {
      pinching = false;
      gestureEndedAt = Date.now();
    }
    if (dragging && e.touches.length === 0) {
      dragging = false;
      if (dragMoved > 8) gestureEndedAt = Date.now();
    }
  };
  canvas.addEventListener("touchend", endTouch);
  canvas.addEventListener("touchcancel", endTouch);
}
