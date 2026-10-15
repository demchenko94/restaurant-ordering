import type {
  CartChange,
  CheckoutQuote,
  CheckoutRequest,
  MenuItem,
  PricedLine,
} from '@restaurant/contracts';
import { lineTotal } from './money';

export interface QuoteInput {
  request: CheckoutRequest;
  items: ReadonlyMap<string, MenuItem>;
  categoryNames: ReadonlyMap<string, string>;
  menuRevision: number;
}

/**
 * Validates a cart against the live menu and prices it. Pure: the same function
 * backs `POST /checkout/quote` and `POST /orders`, so the two can never disagree.
 *
 * Only lines that can be ordered right now end up in `lines`; every problem is
 * reported in `changes`. Prices always come from the menu (or from the user for
 * open-price items) and never from `expectedUnitPriceCents`.
 */
export function buildQuote({
  request,
  items,
  categoryNames,
  menuRevision,
}: QuoteInput): CheckoutQuote {
  const changes: CartChange[] = [];
  const lines: PricedLine[] = [];

  for (const line of request.lines) {
    const item = items.get(line.itemId);
    if (!item) {
      changes.push({ type: 'ITEM_REMOVED', itemId: line.itemId });
      continue;
    }
    if (!item.available) {
      changes.push({ type: 'ITEM_UNAVAILABLE', itemId: item.id });
      continue;
    }

    let unitPriceCents: number;
    if (item.openPrice) {
      if (line.unitPriceCents === undefined) {
        changes.push({ type: 'OPEN_PRICE_REQUIRED', itemId: item.id });
        continue;
      }
      unitPriceCents = line.unitPriceCents;
    } else {
      if (line.unitPriceCents !== undefined) {
        changes.push({ type: 'OPEN_PRICE_NOT_ALLOWED', itemId: item.id });
        continue;
      }
      unitPriceCents = item.priceCents;
      if (
        line.expectedUnitPriceCents !== undefined &&
        line.expectedUnitPriceCents !== unitPriceCents
      ) {
        changes.push({
          type: 'PRICE_CHANGED',
          itemId: item.id,
          previousCents: line.expectedUnitPriceCents,
          currentCents: unitPriceCents,
        });
      }
    }

    lines.push({
      itemId: item.id,
      name: item.name,
      categoryName: categoryNames.get(item.categoryId) ?? '',
      unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: lineTotal(unitPriceCents, line.quantity),
      openPrice: item.openPrice,
    });
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const requestedDiscount = request.discountCents ?? 0;
  if (requestedDiscount > subtotalCents) {
    changes.push({ type: 'DISCOUNT_TOO_HIGH', maxCents: subtotalCents });
  }
  const discountCents = Math.min(requestedDiscount, subtotalCents);

  return {
    menuRevision,
    ok: changes.length === 0,
    changes,
    lines,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
  };
}
