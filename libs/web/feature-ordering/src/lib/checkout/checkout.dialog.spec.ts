import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { CheckoutQuote } from '@restaurant/contracts';
import { category, fixedItem, id, MenuStore } from '@restaurant/web/menu-data-access';
import { OrdersApi } from '@restaurant/web/orders-data-access';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { CartStore } from '../cart/cart.store';
import { CheckoutDialog } from './checkout.dialog';
import { CheckoutStore } from './checkout.store';

const pizza = fixedItem(10, id(1), 950);

const quote: CheckoutQuote = {
  menuRevision: 1,
  ok: false,
  changes: [
    { type: 'ITEM_UNAVAILABLE', itemId: pizza.id },
    { type: 'PRICE_CHANGED', itemId: pizza.id, previousCents: 900, currentCents: 950 },
  ],
  lines: [],
  subtotalCents: 0,
  discountCents: 0,
  totalCents: 0,
};

describe('CheckoutDialog', () => {
  let checkout: InstanceType<typeof CheckoutStore>;

  const render = async () => {
    const fixture = TestBed.createComponent(CheckoutDialog);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: OrdersApi, useValue: {} }],
    });
    TestBed.inject(MenuStore).setSnapshot({
      revision: 1,
      categories: [category(1)],
      items: [pizza],
    });
    TestBed.inject(CartStore).add(pizza);
    checkout = TestBed.inject(CheckoutStore);
  });

  it('lists what changed and offers matching fixes, with confirm disabled', async () => {
    patchState(unprotected(checkout), { phase: 'review', quote, idempotencyKey: 'k' });
    const el = await render();
    const text = el.textContent ?? '';
    expect(text).toContain('Item 10 is no longer available');
    expect(text).toContain('price changed from $9.00 to $9.50');
    expect(text).toContain('Remove unavailable');
    expect(text).toContain('Accept new prices');
    const confirm = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Confirm order'),
    );
    expect(confirm?.disabled).toBe(true);
  });

  it('explains the unknown outcome and offers a safe retry', async () => {
    patchState(unprotected(checkout), {
      phase: 'unknown',
      quote: { ...quote, ok: true, changes: [] },
      idempotencyKey: 'k',
      error: { code: 'NETWORK', message: 'x', status: 0, retryable: true },
    });
    const el = await render();
    expect(el.textContent).toContain("We couldn't confirm your order");
    expect(el.textContent).toContain('Retrying is safe');
    expect([...el.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Retry')).toBe(
      true,
    );
  });

  it('shows the order number once placed', async () => {
    patchState(unprotected(checkout), {
      phase: 'placed',
      order: {
        id: id(99),
        number: 42,
        status: 'placed',
        lines: [],
        subtotalCents: 950,
        discountCents: 0,
        totalCents: 950,
        createdAt: '',
        updatedAt: '',
      },
    });
    const el = await render();
    expect(el.textContent).toContain('Order #42');
    expect(el.textContent).toContain('View orders');
  });
});
