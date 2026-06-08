// Holds the app's astronomical state — catalog, TLEs, observer — and the latest
// computed positions. The render loop drives it (recomputeBodies / recomputeSatellites)
// and reads `bodies` / `satellites`; everything here is DOM-free and the heavy lifting
// lives in the pure modules it composes, so it's straightforward to unit-test.

import type { Observer } from "../astronomy/coordinates";
import type { TLE } from "../astronomy/satellites";
import type { Star } from "../data/stars";
import { DEEP_SKY, type DeepSkyObject } from "../data/deepSky";
import type { RenderedSatellite } from "../render/satellites";
import type { HighlightItem } from "../components/Highlights";
import { constellationNames } from "../render/constellations";
import {
  precessCatalog,
  precessDeepSky,
  computeBodies,
  computeSatellites,
  EMPTY_SKY,
  type SkyBodies,
} from "./compute";
import { buildSearchIndex, type SearchIndex } from "./search";
import { computeHighlights } from "./highlights";

export class SkyEngine {
  observer: Observer | null = null;
  tles: TLE[] = [];
  bodies: SkyBodies = EMPTY_SKY;
  satellites: RenderedSatellite[] = [];
  search: SearchIndex = { items: [], meta: new Map() };

  private precessed: Star[] = [];
  private precessedDeepSky: DeepSkyObject[] = [];

  // Load (or refresh) the star catalog; precess stars + the (static) deep-sky catalog
  // to `epoch` and rebuild the search index. setCatalog is always called at startup, so
  // the deep-sky layer is available even when the star fetch fails (offline).
  setCatalog(stars: Star[], epoch: Date): void {
    this.precessed = precessCatalog(stars, epoch);
    this.precessedDeepSky = precessDeepSky(DEEP_SKY, epoch);
    this.search = buildSearchIndex(this.precessed, constellationNames(), DEEP_SKY);
  }

  setTles(tles: TLE[]): void {
    this.tles = tles;
  }

  hasTles(): boolean {
    return this.tles.length > 0;
  }

  hasStars(): boolean {
    return this.precessed.length > 0;
  }

  recomputeBodies(now: Date): void {
    if (this.observer) {
      this.bodies = computeBodies(this.precessed, this.observer, now, this.precessedDeepSky);
    }
  }

  recomputeSatellites(now: Date): void {
    if (this.observer) {
      this.satellites = computeSatellites(this.tles, this.observer, this.bodies.sun, now);
    }
  }

  highlights(now: Date): HighlightItem[] {
    return this.observer ? computeHighlights(this.bodies, this.observer, now, this.tles) : [];
  }
}
