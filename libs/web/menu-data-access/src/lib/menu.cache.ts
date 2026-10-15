import type { MenuSnapshot } from '@restaurant/contracts';

const KEY = 'restaurant.menu.v1';

/**
 * Structural check only: the cache is written by this app and versioned in its key (bump `KEY`
 * when the snapshot shape changes). Full Zod validation would load Zod at startup.
 */
function looksLikeSnapshot(value: unknown): value is MenuSnapshot {
  const v = value as Partial<MenuSnapshot> | null;
  return (
    !!v &&
    typeof v.revision === 'number' &&
    Array.isArray(v.categories) &&
    Array.isArray(v.items) &&
    v.categories.every((c) => typeof c?.id === 'string' && typeof c.name === 'string') &&
    v.items.every((i) => typeof i?.id === 'string' && typeof i.categoryId === 'string')
  );
}

/** Last known menu for an instant first paint; the server copy replaces it right after. */
export function readMenuCache(): MenuSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return looksLikeSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeMenuCache(snapshot: MenuSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Storage may be full or blocked; the cache is only an optimisation.
  }
}

export function clearMenuCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
