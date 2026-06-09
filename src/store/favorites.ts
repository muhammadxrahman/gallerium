// Observing list / favorites: a persisted set of search-index ids (e.g. "planet:Jupiter",
// "deepsky:M31"). The store is tiny; the list operation is a pure helper so it's testable
// without touching storage, and a separate helper floats favorites to the top of the
// search list. Persistence (localStorage) is best-effort and never throws.

import type { SearchItem } from "../components/Search";

const KEY = "gallerium-favorites";

let ids: string[] = load();

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

// Pure list toggle: add the id if absent (appended), remove it if present.
export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function getFavorites(): string[] {
  return [...ids];
}

export function isFavorite(id: string): boolean {
  return ids.includes(id);
}

// Toggle and persist; returns the new favorited state of `id`.
export function toggleFavorite(id: string): boolean {
  ids = toggleId(ids, id);
  save();
  return ids.includes(id);
}

// Reorder search items so favorites come first, tagged so the UI can mark them.
export function withFavoritesFirst(items: SearchItem[], favIds: string[]): SearchItem[] {
  const favSet = new Set(favIds);
  const fav = items.filter((i) => favSet.has(i.id)).map((i) => ({ ...i, sublabel: "★ Saved" }));
  const rest = items.filter((i) => !favSet.has(i.id));
  return [...fav, ...rest];
}
