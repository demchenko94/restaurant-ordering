import type { CheckoutRequest, MenuItem } from '@restaurant/contracts';
import { buildQuote } from './quote';

const cat = 'c'.repeat(24);
const id = (n: number) => n.toString(16).padStart(24, '0');

const pizza: MenuItem = {
  id: id(1),
  sortOrder: 0,
  categoryId: cat,
  name: 'Margherita',
  available: true,
  openPrice: false,
  priceCents: 950,
};
const special: MenuItem = {
  id: id(2),
  sortOrder: 1,
  categoryId: cat,
  name: 'Chef special',
  available: true,
  openPrice: true,
  priceCents: null,
};
const soldOut: MenuItem = { ...pizza, id: id(3), name: 'Tiramisu', available: false };

const items = new Map([pizza, special, soldOut].map((i) => [i.id, i]));
const categoryNames = new Map([[cat, 'Mains']]);

const quote = (request: CheckoutRequest) =>
  buildQuote({ request, items, categoryNames, menuRevision: 7 });

describe('buildQuote', () => {
  it('prices a valid cart from the menu', () => {
    const q = quote({
      lines: [
        { itemId: pizza.id, quantity: 2, expectedUnitPriceCents: 950 },
        { itemId: special.id, quantity: 1, unitPriceCents: 1500 },
      ],
      discountCents: 500,
    });
    expect(q.ok).toBe(true);
    expect(q.menuRevision).toBe(7);
    expect(q.subtotalCents).toBe(3400);
    expect(q.discountCents).toBe(500);
    expect(q.totalCents).toBe(2900);
    expect(q.lines[0]).toMatchObject({
      name: 'Margherita',
      categoryName: 'Mains',
      lineTotalCents: 1900,
    });
  });

  it('reports removed items and leaves them out of the totals', () => {
    const q = quote({
      lines: [
        { itemId: id(99), quantity: 1 },
        { itemId: pizza.id, quantity: 1 },
      ],
    });
    expect(q.ok).toBe(false);
    expect(q.changes).toEqual([{ type: 'ITEM_REMOVED', itemId: id(99) }]);
    expect(q.subtotalCents).toBe(950);
  });

  it('reports unavailable items', () => {
    const q = quote({ lines: [{ itemId: soldOut.id, quantity: 1 }] });
    expect(q.changes).toEqual([{ type: 'ITEM_UNAVAILABLE', itemId: soldOut.id }]);
    expect(q.lines).toHaveLength(0);
  });

  it('reports a price change but still prices the line at the current price', () => {
    const q = quote({ lines: [{ itemId: pizza.id, quantity: 1, expectedUnitPriceCents: 900 }] });
    expect(q.ok).toBe(false);
    expect(q.changes).toEqual([
      { type: 'PRICE_CHANGED', itemId: pizza.id, previousCents: 900, currentCents: 950 },
    ]);
    expect(q.totalCents).toBe(950);
  });

  it('requires a price for open-price items and forbids one for fixed-price items', () => {
    const q = quote({
      lines: [
        { itemId: special.id, quantity: 1 },
        { itemId: pizza.id, quantity: 1, unitPriceCents: 100 },
      ],
    });
    expect(q.changes).toEqual([
      { type: 'OPEN_PRICE_REQUIRED', itemId: special.id },
      { type: 'OPEN_PRICE_NOT_ALLOWED', itemId: pizza.id },
    ]);
    expect(q.lines).toHaveLength(0);
  });

  it('allows a discount equal to the subtotal', () => {
    const q = quote({ lines: [{ itemId: pizza.id, quantity: 1 }], discountCents: 950 });
    expect(q.ok).toBe(true);
    expect(q.totalCents).toBe(0);
  });

  it('flags and clamps a discount above the subtotal', () => {
    const q = quote({ lines: [{ itemId: pizza.id, quantity: 1 }], discountCents: 951 });
    expect(q.ok).toBe(false);
    expect(q.changes).toEqual([{ type: 'DISCOUNT_TOO_HIGH', maxCents: 950 }]);
    expect(q.discountCents).toBe(950);
    expect(q.totalCents).toBe(0);
  });

  it('flags any discount when no line can be ordered', () => {
    const q = quote({ lines: [{ itemId: soldOut.id, quantity: 1 }], discountCents: 100 });
    expect(q.changes).toContainEqual({ type: 'DISCOUNT_TOO_HIGH', maxCents: 0 });
  });
});
