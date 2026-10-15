import { CheckoutRequest } from './checkout';
import { MAX_LINES, MAX_QTY } from './constants';

const itemId = 'b'.repeat(24);

describe('CheckoutRequest', () => {
  it('defaults the discount to zero', () => {
    const parsed = CheckoutRequest.parse({ lines: [{ itemId, quantity: 1 }] });
    expect(parsed.discountCents).toBe(0);
  });

  it('rejects an empty cart', () => {
    expect(CheckoutRequest.safeParse({ lines: [] }).success).toBe(false);
  });

  it('rejects out-of-range quantities', () => {
    for (const quantity of [0, -1, 1.5, MAX_QTY + 1]) {
      expect(CheckoutRequest.safeParse({ lines: [{ itemId, quantity }] }).success).toBe(false);
    }
  });

  it('rejects too many lines', () => {
    const lines = Array.from({ length: MAX_LINES + 1 }, () => ({ itemId, quantity: 1 }));
    expect(CheckoutRequest.safeParse({ lines }).success).toBe(false);
  });

  it('rejects a negative discount', () => {
    expect(
      CheckoutRequest.safeParse({ lines: [{ itemId, quantity: 1 }], discountCents: -1 }).success,
    ).toBe(false);
  });
});
