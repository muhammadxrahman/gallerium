import type { RenderedStar } from "../render/stars";
import type { RenderedPlanet } from "../render/planets";
import type { RenderedSatellite } from "../render/satellites";

export type SelectedObject =
  | { type: "star"; data: RenderedStar }
  | { type: "planet"; data: RenderedPlanet }
  | { type: "satellite"; data: RenderedSatellite }
  | null;

export const state = {
  selected: null as SelectedObject,
};