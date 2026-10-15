import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { CheckoutQuote, Order } from '@restaurant/contracts';
import { category, fixedItem, id, MenuStore } from '@restaurant/web/menu-data-access';
import { OrdersApi, OrdersStore } from '@restaurant/web/orders-data-access';
import { of, Subject, throwError } from 'rxjs';
import { CartStore } from '../cart/cart.store';
import { CheckoutStore } from './checkout.store';

const pizza = fixedItem(10, id(1), 950);

const quote = (overrides: Partial<CheckoutQuote> = {}): CheckoutQuote => ({
  menuRevision: 1,
  ok: true,
  changes: [],
  lines: [
    {
      itemId: pizza.id,
      name: 'Item 10',
      categoryName: 'Pizza',
      unitPriceCents: 950,
      quantity: 1,
      lineTotalCents: 950,
      openPrice: false,
    },
  ],
  subtotalCents: 950,
  discountCents: 0,
  totalCents: 950,
  ...overrides,
});

const placed: Order = {
  id: id(99),
  number: 7,
  status: 'placed',
  lines: [],
  subtotalCents: 950,
  discountCents: 0,
  totalCents: 950,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const httpError = (status: number, code?: string) =>
  new HttpErrorResponse({
    status,
    error: code ? { error: { code, message: code, requestId: 'r', details: [] } } : undefined,
  });

describe('CheckoutStore', () => {
  let api: { quote: jest.Mock; place: jest.Mock };
  let checkout: InstanceType<typeof CheckoutStore>;
  let cart: InstanceType<typeof CartStore>;
  let orders: InstanceType<typeof OrdersStore>;

  beforeEach(() => {
    localStorage.clear();
    api = { quote: jest.fn(() => of(quote())), place: jest.fn(() => of(placed)) };
    TestBed.configureTestingModule({
      providers: [
        { provide: OrdersApi, useValue: { ...api, list: jest.fn(), setStatus: jest.fn() } },
      ],
    });
    // The provider above copies the mocks; keep a reference to the real object instead.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: OrdersApi, useValue: api }] });
    TestBed.inject(MenuStore).setSnapshot({
      revision: 1,
      categories: [category(1)],
      items: [pizza],
    });
    cart = TestBed.inject(CartStore);
    orders = TestBed.inject(OrdersStore);
    checkout = TestBed.inject(CheckoutStore);
    cart.add(pizza);
  });

  it('does nothing for an empty cart', async () => {
    cart.clear();
    await checkout.start();
    expect(checkout.phase()).toBe('idle');
    expect(api.quote).not.toHaveBeenCalled();
  });

  it('start() quotes the cart with what the user saw, then waits for review', async () => {
    await checkout.start();
    expect(checkout.phase()).toBe('review');
    expect(checkout.canConfirm()).toBe(true);
    expect(api.quote).toHaveBeenCalledWith({
      lines: [{ itemId: pizza.id, quantity: 1, expectedUnitPriceCents: 950 }],
      discountCents: 0,
    });
  });

  it('confirm() places the order once, clears the cart and publishes the order', async () => {
    await checkout.start();
    const key = checkout.idempotencyKey();
    await Promise.all([checkout.confirm(), checkout.confirm(), checkout.confirm()]);

    expect(api.place).toHaveBeenCalledTimes(1);
    expect(api.place.mock.calls[0][0]).toBe(key);
    expect(checkout.phase()).toBe('placed');
    expect(checkout.order()?.number).toBe(7);
    expect(cart.isEmpty()).toBe(true);
    expect(orders.entityMap()[placed.id]).toBeDefined();
  });

  it('blocks confirmation while the quote has changes', async () => {
    api.quote.mockReturnValue(
      of(
        quote({ ok: false, changes: [{ type: 'ITEM_UNAVAILABLE', itemId: pizza.id }], lines: [] }),
      ),
    );
    await checkout.start();
    expect(checkout.phase()).toBe('review');
    expect(checkout.canConfirm()).toBe(false);
    await checkout.confirm();
    expect(api.place).not.toHaveBeenCalled();
  });

  it('goes back to review with the changes when the server answers CART_CHANGED', async () => {
    await checkout.start();
    api.place.mockReturnValue(throwError(() => httpError(409, 'CART_CHANGED')));
    api.quote.mockReturnValue(
      of(
        quote({
          ok: false,
          changes: [
            { type: 'PRICE_CHANGED', itemId: pizza.id, previousCents: 950, currentCents: 1000 },
          ],
        }),
      ),
    );
    await checkout.confirm();
    expect(checkout.phase()).toBe('review');
    expect(checkout.changes()).toHaveLength(1);
    expect(cart.isEmpty()).toBe(false);
  });

  it('after a lost connection asks to retry and retries with the SAME key', async () => {
    await checkout.start();
    const key = checkout.idempotencyKey();
    api.place.mockReturnValueOnce(throwError(() => httpError(0)));
    await checkout.confirm();
    expect(checkout.phase()).toBe('unknown');
    expect(cart.isEmpty()).toBe(false);

    api.place.mockReturnValueOnce(of(placed));
    await checkout.retryConfirm();
    expect(api.place).toHaveBeenCalledTimes(2);
    expect(api.place.mock.calls[1][0]).toBe(key);
    expect(checkout.phase()).toBe('placed');
  });

  it('treats a server error like a lost answer (the order may exist)', async () => {
    await checkout.start();
    api.place.mockReturnValueOnce(throwError(() => httpError(500, 'INTERNAL')));
    await checkout.confirm();
    expect(checkout.phase()).toBe('unknown');
  });

  it('fails and drops the key when the key was reused with another body', async () => {
    await checkout.start();
    api.place.mockReturnValueOnce(throwError(() => httpError(422, 'IDEMPOTENCY_KEY_REUSED')));
    await checkout.confirm();
    expect(checkout.phase()).toBe('failed');
    expect(checkout.idempotencyKey()).toBeNull();
  });

  it('restart() begins again with a new key', async () => {
    await checkout.start();
    const first = checkout.idempotencyKey();
    api.place.mockReturnValueOnce(throwError(() => httpError(422, 'IDEMPOTENCY_KEY_REUSED')));
    await checkout.confirm();
    await checkout.restart();
    expect(checkout.phase()).toBe('review');
    expect(checkout.idempotencyKey()).not.toBe(first);
  });

  it('fails when the quote request fails', async () => {
    api.quote.mockReturnValue(throwError(() => httpError(0)));
    await checkout.start();
    expect(checkout.phase()).toBe('failed');
    expect(checkout.error()?.code).toBe('NETWORK');
  });

  it('refuses to start a second checkout while one is running', async () => {
    const pending = new Subject<CheckoutQuote>();
    api.quote.mockReturnValue(pending);
    const first = checkout.start();
    await checkout.start();
    expect(api.quote).toHaveBeenCalledTimes(1);
    pending.next(quote());
    pending.complete();
    await first;
  });

  it('re-quotes in the background when the menu changes during review', async () => {
    jest.useFakeTimers();
    try {
      await checkout.start();
      api.quote.mockClear();
      TestBed.inject(MenuStore).applyEvent({
        type: 'menu.item.upserted',
        revision: 2,
        item: fixedItem(10, id(1), 1100),
      });
      TestBed.tick();
      await jest.advanceTimersByTimeAsync(400);
      expect(api.quote).toHaveBeenCalledTimes(1);
      expect(checkout.phase()).toBe('review');
    } finally {
      jest.useRealTimers();
    }
  });

  it('reset() returns to idle', async () => {
    await checkout.start();
    checkout.reset();
    expect(checkout.phase()).toBe('idle');
    expect(checkout.quote()).toBeNull();
  });
});
