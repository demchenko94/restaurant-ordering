import { computed, effect, inject, untracked } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import type { CheckoutRequest } from '@restaurant/contracts';
import { toApiErrorView, type ApiErrorView } from '@restaurant/web/core';
import { MenuStore } from '@restaurant/web/menu-data-access';
import { OrdersApi, OrdersStore } from '@restaurant/web/orders-data-access';
import { exhaustMap, filter, pipe, switchMap, tap } from 'rxjs';
import { CartStore } from '../cart/cart.store';
import { initialCheckoutState, REQUOTE_DEBOUNCE_MS, type CheckoutState } from './checkout.state';

/**
 * Checkout as an explicit state machine (see docs/ui-design.md):
 *
 *   idle → quoting → review → confirming → placed
 *                      ↑          ↓ 409: back to review with the changes
 *                      └──── unknown (retry with the same key)
 *
 * Concurrency is expressed in the operators: a newer quote cancels an older one (`switchMap`),
 * and a second confirm while one is in flight is ignored (`exhaustMap`), on top of the phase
 * guards. The idempotency key makes a retry after a lost answer safe.
 */
export const CheckoutStore = signalStore(
  { providedIn: 'root' },
  withState<CheckoutState>(initialCheckoutState),
  withComputed(({ quote, phase, refreshing }) => ({
    changes: computed(() => quote()?.changes ?? []),
    canConfirm: computed(
      () =>
        phase() === 'review' &&
        quote()?.ok === true &&
        !refreshing() &&
        (quote()?.lines.length ?? 0) > 0,
    ),
    busy: computed(() => phase() === 'quoting' || phase() === 'confirming'),
  })),
  withMethods((store) => {
    const api = inject(OrdersApi);
    const cart = inject(CartStore);
    const orders = inject(OrdersStore);

    /** What the user currently has, in the shape the server validates. */
    const buildRequest = (): CheckoutRequest => ({
      lines: cart.views().map(({ line }) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        ...(line.unitPriceCents !== undefined ? { unitPriceCents: line.unitPriceCents } : {}),
        ...(line.seenPriceCents !== undefined
          ? { expectedUnitPriceCents: line.seenPriceCents }
          : {}),
      })),
      discountCents: cart.discountCents(),
    });

    /** Validates the cart. `background` keeps the dialog on screen instead of showing a spinner. */
    const runQuote = rxMethod<{ background: boolean }>(
      pipe(
        tap(({ background }) =>
          patchState(store, background ? { refreshing: true } : { phase: 'quoting', error: null }),
        ),
        switchMap(({ background }) =>
          api.quote(buildRequest()).pipe(
            tapResponse({
              next: (quote) =>
                patchState(store, { phase: 'review', quote, refreshing: false, error: null }),
              error: (error) =>
                patchState(
                  store,
                  background
                    ? { refreshing: false }
                    : { phase: 'failed', error: toApiErrorView(error), refreshing: false },
                ),
            }),
          ),
        ),
      ),
    );

    const onPlaceFailed = (view: ApiErrorView) => {
      if (view.code === 'CART_CHANGED') {
        // The menu moved under the user: show what changed, keep the same key.
        runQuote({ background: false });
      } else if (
        view.code === 'IDEMPOTENCY_KEY_REUSED' ||
        view.code === 'IDEMPOTENCY_KEY_REQUIRED'
      ) {
        patchState(store, { phase: 'failed', error: view, idempotencyKey: null });
      } else if (view.retryable || view.status === 0 || view.status >= 500) {
        // No reliable answer: the order may exist. Only a same-key retry is safe.
        patchState(store, { phase: 'unknown', error: view });
      } else {
        patchState(store, { phase: 'failed', error: view });
      }
    };

    const place = rxMethod<void>(
      pipe(
        filter(() => store.idempotencyKey() !== null),
        tap(() => patchState(store, { phase: 'confirming', error: null })),
        exhaustMap(() =>
          api.place(store.idempotencyKey() as string, buildRequest()).pipe(
            tapResponse({
              next: (order) => {
                orders.upsert(order);
                cart.clear();
                patchState(store, { phase: 'placed', order, error: null });
              },
              error: (error) => onPlaceFailed(toApiErrorView(error)),
            }),
          ),
        ),
      ),
    );

    const start = (): void => {
      if (cart.isEmpty() || store.busy()) return;
      patchState(store, { ...initialCheckoutState, idempotencyKey: crypto.randomUUID() });
      runQuote({ background: false });
    };

    return {
      /** Opens the review step: one fresh key per attempt. */
      start,

      /** Re-validates after the user fixed something (removed items, accepted prices). */
      requote(): void {
        runQuote({ background: store.phase() === 'review' });
      },

      confirm(): void {
        if (store.canConfirm()) place();
      },

      /** After `unknown`: same key, so the server returns the existing order if there is one. */
      retryConfirm(): void {
        if (store.phase() === 'unknown') place();
      },

      /** After a failure without a usable key (or a failed quote): begin again with a new key. */
      restart(): void {
        patchState(store, initialCheckoutState);
        start();
      },

      reset(): void {
        patchState(store, initialCheckoutState);
      },
    };
  }),
  withHooks({
    onInit(store) {
      const menu = inject(MenuStore);
      const cart = inject(CartStore);

      // While the user reviews, any live menu or cart change re-runs the quote, so the dialog
      // shows changes before the user confirms.
      effect((onCleanup) => {
        menu.revision();
        cart.lines();
        cart.discountCents();
        if (untracked(store.phase) !== 'review') return;
        const timer = setTimeout(() => store.requote(), REQUOTE_DEBOUNCE_MS);
        onCleanup(() => clearTimeout(timer));
      });
    },
  }),
);
