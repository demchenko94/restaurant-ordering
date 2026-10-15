import type {
  Category,
  CategoryInput,
  CategoryPatch,
  MenuItem,
  MenuItemInput,
  MenuItemPatch,
} from '@restaurant/contracts';
import { toApiErrorView } from '@restaurant/web/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type { MenuApi } from './menu.api';

/** What the commands need from the store, without depending on its generated types. */
export interface MenuCommandsPort {
  getItem(id: string): MenuItem | undefined;
  upsertCategory(category: Category): void;
  removeCategory(id: string): void;
  upsertItem(item: MenuItem): void;
  patchItem(id: string, changes: Partial<MenuItem>): void;
  removeItem(id: string): void;
}

/**
 * Write side of the menu (the Setup screen). Commands resolve with the saved entity and reject
 * with an `ApiErrorView`, so a form can show the failure next to its fields. The response is
 * applied immediately; the later SSE echo of the same change is a no-op by revision.
 */
export function createMenuCommands(api: MenuApi, store: MenuCommandsPort) {
  const send = async <T>(request: Observable<T>): Promise<T> => {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiErrorView(error);
    }
  };

  return {
    async createCategory(input: CategoryInput): Promise<Category> {
      const category = await send(api.createCategory(input));
      store.upsertCategory(category);
      return category;
    },

    async updateCategory(id: string, patch: CategoryPatch): Promise<Category> {
      const category = await send(api.updateCategory(id, patch));
      store.upsertCategory(category);
      return category;
    },

    async deleteCategory(id: string): Promise<void> {
      await send(api.deleteCategory(id));
      store.removeCategory(id);
    },

    async createItem(input: MenuItemInput): Promise<MenuItem> {
      const item = await send(api.createItem(input));
      store.upsertItem(item);
      return item;
    },

    async updateItem(id: string, patch: MenuItemPatch): Promise<MenuItem> {
      const item = await send(api.updateItem(id, patch));
      store.upsertItem(item);
      return item;
    },

    /** Optimistic: flips immediately and rolls back if the server refuses. */
    async setAvailability(id: string, available: boolean): Promise<void> {
      const previous = store.getItem(id);
      if (!previous) return;
      store.patchItem(id, { available });
      try {
        store.upsertItem(await send(api.updateItem(id, { available })));
      } catch (error) {
        store.upsertItem(previous);
        throw error;
      }
    },

    async deleteItem(id: string): Promise<void> {
      await send(api.deleteItem(id));
      store.removeItem(id);
    },
  };
}
