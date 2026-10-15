import { MAX_PRICE_CENTS, MAX_QTY } from '@restaurant/contracts';

/** User intent only. Names and prices are looked up live, never copied into the cart. */
export interface CartLine {
  /** Fixed-price items: the item id. Open-price items: `<itemId>:<priceCents>`. */
  key: string;
  itemId: string;
  quantity: number;
  /** Only for open-price items: the price the user entered. */
  unitPriceCents?: number;
  /** Fixed-price items: the price the user last saw; compared with the live price. */
  seenPriceCents?: number;
}

export type CartState = {
  lines: CartLine[];
  discountCents: number;
};

export const initialCartState: CartState = { lines: [], discountCents: 0 };

/** Bump the version suffix when `CartState` changes shape. */
export const CART_STORAGE_KEY = 'restaurant.cart.v1';
const MAX_LINES = 100;

export const lineKey = (itemId: string, unitPriceCents?: number): string =>
  unitPriceCents === undefined ? itemId : `${itemId}:${unitPriceCents}`;

const isCents = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_PRICE_CENTS;

const isValidLine = (line: Partial<CartLine> | null | undefined): line is CartLine =>
  typeof line?.key === 'string' &&
  typeof line.itemId === 'string' &&
  /^[a-f0-9]{24}$/.test(line.itemId) &&
  Number.isInteger(line.quantity) &&
  (line.quantity as number) >= 1 &&
  (line.quantity as number) <= MAX_QTY &&
  (line.unitPriceCents === undefined || isCents(line.unitPriceCents)) &&
  (line.seenPriceCents === undefined || isCents(line.seenPriceCents));

/**
 * Turns whatever was in storage into a safe cart: malformed lines are dropped, a bad discount
 * becomes 0. (Structural checks instead of Zod keep Zod out of the startup bundle.)
 */
export function sanitizeCart(raw: unknown): CartState | null {
  const data = raw as Partial<CartState> | null;
  if (!data || !Array.isArray(data.lines)) return null;
  const discount = data.discountCents;
  return {
    lines: data.lines.filter(isValidLine).slice(0, MAX_LINES),
    discountCents:
      Number.isInteger(discount) && (discount as number) >= 0 ? (discount as number) : 0,
  };
}
