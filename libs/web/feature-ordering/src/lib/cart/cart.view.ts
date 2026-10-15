import type { MenuItem } from '@restaurant/contracts';
import type { CartLine } from './cart.state';

export type CartLineStatus = 'ok' | 'unavailable' | 'removed' | 'price-changed';

/** A cart line joined with the live menu: what the UI and the totals actually use. */
export interface CartLineView {
  line: CartLine;
  item: MenuItem | null;
  status: CartLineStatus;
  /** Live unit price (fixed) or the entered price (open); null when unknown. */
  unitPriceCents: number | null;
  lineTotalCents: number;
  /** Whether the line contributes to the totals. */
  orderable: boolean;
}

/** Pure join of one cart line with its menu item (or `null` when the item is gone). */
export function toCartLineView(line: CartLine, item: MenuItem | null): CartLineView {
  if (!item) {
    return {
      line,
      item,
      status: 'removed',
      unitPriceCents: null,
      lineTotalCents: 0,
      orderable: false,
    };
  }
  const unitPriceCents = item.openPrice ? (line.unitPriceCents ?? null) : item.priceCents;
  if (!item.available) {
    return {
      line,
      item,
      status: 'unavailable',
      unitPriceCents,
      lineTotalCents: 0,
      orderable: false,
    };
  }
  const priceChanged =
    !item.openPrice && line.seenPriceCents !== undefined && line.seenPriceCents !== item.priceCents;
  return {
    line,
    item,
    status: priceChanged ? 'price-changed' : 'ok',
    unitPriceCents,
    lineTotalCents: (unitPriceCents ?? 0) * line.quantity,
    orderable: unitPriceCents !== null,
  };
}
