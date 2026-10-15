import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { MAX_QTY, type MenuItem } from '@restaurant/contracts';
import { withStorageSync } from '@restaurant/web/core';
import { MenuStore } from '@restaurant/web/menu-data-access';
import {
  CART_STORAGE_KEY,
  initialCartState,
  lineKey,
  sanitizeCart,
  type CartLine,
  type CartState,
} from './cart.state';
import { toCartLineView, type CartLineView } from './cart.view';

/**
 * The shopping cart. Holds only what the user chose; every price, name and availability is
 * joined live from the `MenuStore`, so menu changes show up in the cart instantly.
 * Persisted to `localStorage` through the reusable `withStorageSync` feature.
 */
export const CartStore = signalStore(
  { providedIn: 'root' },
  withState<CartState>(initialCartState),
  withStorageSync<CartState>({ key: CART_STORAGE_KEY, restore: sanitizeCart }),
  withComputed((store, menu = inject(MenuStore)) => {
    const views = computed<CartLineView[]>(() => {
      const itemById = menu.itemById();
      return store.lines().map((line) => toCartLineView(line, itemById.get(line.itemId) ?? null));
    });
    const subtotalCents = computed(() =>
      views().reduce((sum, view) => (view.orderable ? sum + view.lineTotalCents : sum), 0),
    );

    return {
      views,
      subtotalCents,
      discountError: computed(() =>
        store.discountCents() > subtotalCents() ? 'Discount can’t exceed the subtotal' : null,
      ),
      totalCents: computed(() => Math.max(0, subtotalCents() - store.discountCents())),
      /** Total quantity, for the badge. */
      count: computed(() => store.lines().reduce((n, l) => n + l.quantity, 0)),
      isEmpty: computed(() => store.lines().length === 0),
      /** Quantity per fixed-price item, for the steppers in the catalog. */
      quantityByItem: computed(() => {
        const map = new Map<string, number>();
        for (const line of store.lines()) {
          if (line.unitPriceCents === undefined) map.set(line.itemId, line.quantity);
        }
        return map;
      }),
      hasUnavailable: computed(() =>
        views().some((v) => v.status === 'unavailable' || v.status === 'removed'),
      ),
      hasPriceChanges: computed(() => views().some((v) => v.status === 'price-changed')),
    };
  }),
  withMethods((store) => ({
    /** Adds an item. Fixed-price items merge by id; open-price items by id and entered price. */
    add(item: MenuItem, quantity = 1, unitPriceCents?: number): void {
      const price = item.openPrice ? unitPriceCents : undefined;
      if (item.openPrice && price === undefined) return;
      const key = lineKey(item.id, price);
      patchState(store, (s) => {
        if (s.lines.some((l) => l.key === key)) {
          return {
            lines: s.lines.map((l) =>
              l.key === key ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + quantity) } : l,
            ),
          };
        }
        const line: CartLine = {
          key,
          itemId: item.id,
          quantity: Math.min(MAX_QTY, quantity),
          ...(price !== undefined ? { unitPriceCents: price } : {}),
          ...(!item.openPrice ? { seenPriceCents: item.priceCents } : {}),
        };
        return { lines: [...s.lines, line] };
      });
    },

    /** Sets the quantity (clamped to the maximum); zero or less removes the line. */
    setQuantity(key: string, quantity: number): void {
      if (quantity < 1) {
        patchState(store, (s) => ({ lines: s.lines.filter((l) => l.key !== key) }));
        return;
      }
      const clamped = Math.min(MAX_QTY, Math.floor(quantity));
      patchState(store, (s) => ({
        lines: s.lines.map((l) => (l.key === key ? { ...l, quantity: clamped } : l)),
      }));
    },

    remove(key: string): void {
      patchState(store, (s) => ({ lines: s.lines.filter((l) => l.key !== key) }));
    },

    removeUnavailable(): void {
      const gone = new Set(
        store
          .views()
          .filter((v) => v.status === 'unavailable' || v.status === 'removed')
          .map((v) => v.line.key),
      );
      patchState(store, (s) => ({ lines: s.lines.filter((l) => !gone.has(l.key)) }));
    },

    /** The user accepts the current menu prices: remember them as the prices they have seen. */
    acknowledgePrices(): void {
      const current = new Map(
        store
          .views()
          .filter((v) => v.status === 'price-changed')
          .map((v) => [v.line.key, v.unitPriceCents as number]),
      );
      patchState(store, (s) => ({
        lines: s.lines.map((l) =>
          current.has(l.key) ? { ...l, seenPriceCents: current.get(l.key) } : l,
        ),
      }));
    },

    setDiscount(cents: number): void {
      patchState(store, { discountCents: Math.max(0, Math.floor(cents)) });
    },

    clear(): void {
      patchState(store, initialCartState);
    },
  })),
);
