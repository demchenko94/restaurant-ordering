import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  removeEntity,
  setAllEntities,
  setEntity,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import type { MenuItem, MenuSnapshot, ServerEvent } from '@restaurant/contracts';
import { toApiErrorView, withRequestStatus } from '@restaurant/web/core';
import { pipe, switchMap, tap } from 'rxjs';
import { MenuApi } from './menu.api';
import { readMenuCache, writeMenuCache } from './menu.cache';
import { createMenuCommands } from './menu.commands';
import { categoryConfig, initialMenuState, itemConfig } from './menu.state';

const CACHE_DEBOUNCE_MS = 2000;

/**
 * The normalized menu. Both HTTP responses and live SSE events end up in the same entity
 * updates, so a fetched menu and a pushed change can never diverge.
 *
 * Composition: entities + state + request status → derived indexes → methods (sync: load and live
 * events; commands: Setup writes, see `menu.commands.ts`). Components only read signals and
 * call methods.
 */
export const MenuStore = signalStore(
  { providedIn: 'root' },
  withState(initialMenuState),
  withRequestStatus(),
  withEntities(categoryConfig),
  withEntities(itemConfig),
  withComputed(({ categoryEntities, itemEntities, categoryEntityMap, itemEntityMap }) => ({
    categoriesSorted: computed(() =>
      [...categoryEntities()].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    ),
    itemsByCategory: computed(() => {
      const byCategory = new Map<string, MenuItem[]>();
      for (const item of itemEntities()) {
        const list = byCategory.get(item.categoryId);
        if (list) list.push(item);
        else byCategory.set(item.categoryId, [item]);
      }
      for (const list of byCategory.values()) {
        list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      }
      return byCategory;
    }),
    categoryById: computed(() => new Map(Object.entries(categoryEntityMap()))),
    itemById: computed(() => new Map(Object.entries(itemEntityMap()))),
    isEmpty: computed(() => categoryEntities().length === 0 && itemEntities().length === 0),
  })),
  withMethods((store) => {
    const api = inject(MenuApi);
    let persistTimer: ReturnType<typeof setTimeout> | null = null;

    const snapshot = (): MenuSnapshot => ({
      revision: store.revision(),
      categories: store.categoryEntities(),
      items: store.itemEntities(),
    });

    const setSnapshot = (data: MenuSnapshot) => {
      patchState(
        store,
        setAllEntities(data.categories, categoryConfig),
        setAllEntities(data.items, itemConfig),
        { revision: data.revision },
      );
    };

    /** The cache is written a moment after the last change, not on every live event. */
    const schedulePersist = () => {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(() => writeMenuCache(snapshot()), CACHE_DEBOUNCE_MS);
    };

    /** Loads the full menu. A newer call cancels an older in-flight one (no stale overwrite). */
    const load = rxMethod<void>(
      pipe(
        tap(() => store.beginRequest(!store.isEmpty())),
        switchMap(() =>
          api.getMenu().pipe(
            tapResponse({
              next: (data) => {
                setSnapshot(data);
                patchState(store, { stale: false });
                store.completeRequest();
                writeMenuCache(data);
              },
              // Keep whatever is on screen: a failed refresh must not blank a usable menu.
              error: (error) => store.failRequest(toApiErrorView(error), !store.isEmpty()),
            }),
          ),
        ),
      ),
    );

    const commands = createMenuCommands(api, {
      getItem: (id) => store.itemEntityMap()[id],
      upsertCategory: (category) => patchState(store, setEntity(category, categoryConfig)),
      removeCategory: (id) => patchState(store, removeEntity(id, categoryConfig)),
      upsertItem: (item) => patchState(store, setEntity(item, itemConfig)),
      patchItem: (id, changes) => patchState(store, updateEntity({ id, changes }, itemConfig)),
      removeItem: (id) => patchState(store, removeEntity(id, itemConfig)),
    });

    return {
      ...commands,
      load,
      /** Re-validate after a reconnect; cheap thanks to the revision ETag. */
      refresh: () => load(),
      setSnapshot,

      /** Applies a live event following the revision rule (see docs/realtime.md). */
      applyEvent(event: ServerEvent): void {
        if (
          event.type !== 'menu.category.upserted' &&
          event.type !== 'menu.category.deleted' &&
          event.type !== 'menu.item.upserted' &&
          event.type !== 'menu.item.deleted'
        ) {
          return;
        }
        const current = store.revision();
        if (event.revision <= current) return; // duplicate or already in the snapshot
        if (event.revision > current + 1) {
          load(); // gap: events were missed
          return;
        }
        switch (event.type) {
          case 'menu.category.upserted':
            patchState(store, setEntity(event.category, categoryConfig));
            break;
          case 'menu.category.deleted':
            patchState(store, removeEntity(event.id, categoryConfig));
            break;
          case 'menu.item.upserted':
            patchState(store, setEntity(event.item, itemConfig));
            break;
          case 'menu.item.deleted':
            patchState(store, removeEntity(event.id, itemConfig));
            break;
        }
        patchState(store, { revision: event.revision });
        schedulePersist();
      },
    };
  }),
  withHooks({
    onInit(store) {
      const cached = readMenuCache();
      if (cached) {
        store.setSnapshot(cached);
        patchState(store, { stale: true });
        store.markReady();
      }
    },
  }),
);
