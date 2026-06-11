// Off-main-thread body compute. Projecting ~9,000 stars to apparent alt/az every second
// (equatorial→horizontal + refraction, plus the planets/Moon/Sun) is the heaviest tick in
// the app; running it here keeps the render thread free so frames never hitch — even on a
// low-end phone. The worker holds the precessed catalog (sent once per load) and, on each
// `compute`, returns a full `SkyBodies` snapshot. It's thin glue over the *tested* pure
// `computeBodies`; the main thread keeps a synchronous fallback for environments without
// worker support.

import { computeBodies } from "./compute";
import type { Star } from "../data/stars";
import type { DeepSkyObject } from "../data/deepSky";
import type { Observer } from "../astronomy/coordinates";

type InMessage =
  | { kind: "catalog"; stars: Star[]; deepSky: DeepSkyObject[] }
  | { kind: "compute"; observer: Observer; timeMs: number };

// Minimal worker-scope shape, so we don't pull in the `webworker` lib (which clashes with
// the project's DOM lib over globals like `self`/`postMessage`).
interface WorkerScope {
  onmessage: ((e: MessageEvent<InMessage>) => void) | null;
  postMessage(message: unknown): void;
}
const ctx = self as unknown as WorkerScope;

let stars: Star[] = []; // already precessed on the main thread
let deepSky: DeepSkyObject[] = [];

ctx.onmessage = (e) => {
  const msg = e.data;
  if (msg.kind === "catalog") {
    stars = msg.stars;
    deepSky = msg.deepSky;
    return;
  }
  // kind === "compute": project everything for this instant and post it back.
  ctx.postMessage(computeBodies(stars, msg.observer, new Date(msg.timeMs), deepSky));
};
