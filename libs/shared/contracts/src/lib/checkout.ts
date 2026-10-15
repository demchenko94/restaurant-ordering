import { z } from 'zod';
import { MAX_LINES, MAX_QTY } from './constants';
import { Cents, Id, PriceCents } from './common';

export const CartLineInput = z.object({
  itemId: Id,
  quantity: z.number().int().min(1).max(MAX_QTY),
  /** Required for open-price items, forbidden for fixed-price items. */
  unitPriceCents: PriceCents.optional(),
  /** The price the user saw when adding the item; used to detect price changes. */
  expectedUnitPriceCents: PriceCents.optional(),
});
export type CartLineInput = z.infer<typeof CartLineInput>;

export const CheckoutRequest = z.object({
  lines: z.array(CartLineInput).min(1).max(MAX_LINES),
  discountCents: Cents.default(0),
});
export type CheckoutRequest = z.input<typeof CheckoutRequest>;

export const CartChange = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ITEM_UNAVAILABLE'), itemId: Id }),
  z.object({ type: z.literal('ITEM_REMOVED'), itemId: Id }),
  z.object({
    type: z.literal('PRICE_CHANGED'),
    itemId: Id,
    previousCents: PriceCents,
    currentCents: PriceCents,
  }),
  z.object({ type: z.literal('OPEN_PRICE_REQUIRED'), itemId: Id }),
  z.object({ type: z.literal('OPEN_PRICE_NOT_ALLOWED'), itemId: Id }),
  z.object({ type: z.literal('DISCOUNT_TOO_HIGH'), maxCents: Cents }),
]);
export type CartChange = z.infer<typeof CartChange>;

export const PricedLine = z.object({
  itemId: Id,
  name: z.string(),
  categoryName: z.string(),
  unitPriceCents: PriceCents,
  quantity: z.number().int(),
  lineTotalCents: Cents,
  openPrice: z.boolean(),
});
export type PricedLine = z.infer<typeof PricedLine>;

/**
 * Result of validating a cart against the live menu. `lines` contains only
 * lines that can be ordered right now (existing, available, correctly priced);
 * totals are computed from them. Problems are listed in `changes`.
 */
export const CheckoutQuote = z.object({
  menuRevision: z.number().int().nonnegative(),
  ok: z.boolean(),
  changes: z.array(CartChange),
  lines: z.array(PricedLine),
  subtotalCents: Cents,
  discountCents: Cents,
  totalCents: Cents,
});
export type CheckoutQuote = z.infer<typeof CheckoutQuote>;
