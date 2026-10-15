import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, setEntities, setEntity, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import type { Order, OrderStatus, ServerEvent } from '@restaurant/contracts';
import { toApiErrorView, withRequestStatus } from '@restaurant/web/core';
import { exhaustMap, filter, firstValueFrom, pipe, switchMap, tap } from 'rxjs';
import { OrdersApi } from './orders.api';
import { HIGHLIGHT_MS, initialOrdersState, ORDERS_PAGE_SIZE } from './orders.state';

/**
 * Orders list, kept current by live events. Newer first-page loads cancel older ones
 * (`switchMap`); "load more" ignores repeats while a page is in flight (`exhaustMap`).
 */
export const OrdersStore = signalStore(
  { providedIn: 'root' },
  withState(initialOrdersState),
  withRequestStatus(),
  withEntities<Order>(),
  withComputed(({ entities, nextCursor }) => ({
    /** Newest first; ties broken by order number. */
    sorted: computed(() =>
      [...entities()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.number - a.number),
    ),
    hasMore: computed(() => nextCursor() !== null),
  })),
  withMethods((store) => {
    const api = inject(OrdersApi);

    const highlight = (id: string) => {
      patchState(store, (s) => ({ highlightedIds: [...s.highlightedIds, id] }));
      setTimeout(
        () =>
          patchState(store, (s) => ({ highlightedIds: s.highlightedIds.filter((x) => x !== id) })),
        HIGHLIGHT_MS,
      );
    };

    return {
      loadFirstPage: rxMethod<void>(
        pipe(
          tap(() => store.beginRequest(store.entities().length > 0)),
          switchMap(() =>
            api.list(ORDERS_PAGE_SIZE).pipe(
              tapResponse({
                next: (page) => {
                  patchState(store, setAllEntities(page.items), { nextCursor: page.nextCursor });
                  store.completeRequest();
                },
                error: (error) =>
                  store.failRequest(toApiErrorView(error), store.entities().length > 0),
              }),
            ),
          ),
        ),
      ),

      loadMore: rxMethod<void>(
        pipe(
          filter(() => store.nextCursor() !== null && !store.loadingMore()),
          tap(() => patchState(store, { loadingMore: true })),
          exhaustMap(() =>
            api.list(ORDERS_PAGE_SIZE, store.nextCursor()).pipe(
              tapResponse({
                next: (page) =>
                  patchState(store, setEntities(page.items), { nextCursor: page.nextCursor }),
                error: (error) => store.failRequest(toApiErrorView(error), true),
                finalize: () => patchState(store, { loadingMore: false }),
              }),
            ),
          ),
        ),
      ),

      applyEvent(event: ServerEvent): void {
        if (event.type !== 'order.created' && event.type !== 'order.updated') return;
        patchState(store, setEntity(event.order));
        highlight(event.order.id);
      },

      /** Manual status change; rejects with an `ApiErrorView`. */
      async setStatus(id: string, status: OrderStatus): Promise<void> {
        try {
          patchState(store, setEntity(await firstValueFrom(api.setStatus(id, status))));
        } catch (error) {
          throw toApiErrorView(error);
        }
      },

      /** Adds an order we just placed, before its SSE echo arrives. */
      upsert(order: Order): void {
        patchState(store, setEntity(order));
      },
    };
  }),
);
