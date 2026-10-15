import { type } from '@ngrx/signals';
import { entityConfig } from '@ngrx/signals/entities';
import type { Category, MenuItem } from '@restaurant/contracts';

export const categoryConfig = entityConfig({ entity: type<Category>(), collection: 'category' });
export const itemConfig = entityConfig({ entity: type<MenuItem>(), collection: 'item' });

export type MenuState = {
  /** Server revision of the menu the entities below correspond to (see docs/realtime.md). */
  revision: number;
  /** True while showing the cached menu that the server has not confirmed yet. */
  stale: boolean;
};

export const initialMenuState: MenuState = { revision: 0, stale: false };
