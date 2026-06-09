import { describe, it, expect, afterEach } from "vitest";
import { toggleId, withFavoritesFirst, toggleFavorite, isFavorite, getFavorites } from "./favorites";
import type { SearchItem } from "../components/Search";

describe("toggleId (pure)", () => {
  it("adds an absent id (appended) and removes a present one", () => {
    expect(toggleId([], "a")).toEqual(["a"]);
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
  });

  it("does not mutate the input", () => {
    const list = ["a"];
    toggleId(list, "b");
    expect(list).toEqual(["a"]);
  });
});

describe("withFavoritesFirst", () => {
  const items: SearchItem[] = [
    { id: "sun", label: "Sun", sublabel: "Star" },
    { id: "planet:Mars", label: "Mars", sublabel: "Planet" },
    { id: "deepsky:M31", label: "Andromeda", sublabel: "Galaxy" },
  ];

  it("floats favorites to the top and tags them, preserving the rest", () => {
    const out = withFavoritesFirst(items, ["deepsky:M31"]);
    expect(out[0].id).toBe("deepsky:M31");
    expect(out[0].sublabel).toBe("★ Saved");
    expect(out.slice(1).map((i) => i.id)).toEqual(["sun", "planet:Mars"]);
  });

  it("is a no-op ordering when there are no favorites", () => {
    expect(withFavoritesFirst(items, []).map((i) => i.id)).toEqual(items.map((i) => i.id));
  });
});

describe("favorites store (persisted)", () => {
  afterEach(() => {
    // leave the store empty for other tests
    for (const id of getFavorites()) toggleFavorite(id);
  });

  it("toggles membership and reports state", () => {
    expect(isFavorite("planet:Saturn")).toBe(false);
    expect(toggleFavorite("planet:Saturn")).toBe(true);
    expect(isFavorite("planet:Saturn")).toBe(true);
    expect(getFavorites()).toContain("planet:Saturn");
    expect(toggleFavorite("planet:Saturn")).toBe(false);
    expect(isFavorite("planet:Saturn")).toBe(false);
  });
});
