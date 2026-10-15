import { TestBed } from '@angular/core/testing';
import type { Order } from '@restaurant/contracts';
import { of, throwError } from 'rxjs';
import { OrdersApi } from './orders.api';
import { OrdersStore } from './orders.store';

const order = (n: number, status: Order['status'] = 'placed'): Order => ({
  id: n.toString(16).padStart(24, '0'),
  number: n,
  status,
  lines: [],
  subtotalCents: 100,
  discountCents: 0,
  totalCents: 100,
  createdAt: new Date(2026, 0, 1, 12, n).toISOString(),
  updatedAt: new Date(2026, 0, 1, 12, n).toISOString(),
});

describe('OrdersStore', () => {
  let api: { list: jest.Mock; setStatus: jest.Mock };
  let store: InstanceType<typeof OrdersStore>;

  beforeEach(() => {
    jest.useFakeTimers();
    api = { list: jest.fn(), setStatus: jest.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: OrdersApi, useValue: api }] });
    store = TestBed.inject(OrdersStore);
  });
  afterEach(() => jest.useRealTimers());

  it('loads the first page, newest first, and remembers the cursor', async () => {
    api.list.mockReturnValue(of({ items: [order(1), order(3), order(2)], nextCursor: 'c1' }));
    await store.loadFirstPage();
    expect(store.sorted().map((o) => o.number)).toEqual([3, 2, 1]);
    expect(store.hasMore()).toBe(true);
    expect(store.status()).toBe('ready');
  });

  it('appends the next page', async () => {
    api.list.mockReturnValueOnce(of({ items: [order(3)], nextCursor: 'c1' }));
    await store.loadFirstPage();
    api.list.mockReturnValueOnce(of({ items: [order(2), order(1)], nextCursor: null }));
    await store.loadMore();
    expect(api.list).toHaveBeenLastCalledWith(30, 'c1');
    expect(store.sorted().map((o) => o.number)).toEqual([3, 2, 1]);
    expect(store.hasMore()).toBe(false);
  });

  it('does not load more without a cursor', async () => {
    await store.loadMore();
    expect(api.list).not.toHaveBeenCalled();
  });

  it('upserts live events and highlights the changed order briefly', async () => {
    api.list.mockReturnValue(of({ items: [order(1)], nextCursor: null }));
    await store.loadFirstPage();

    store.applyEvent({ type: 'order.updated', order: order(1, 'preparing') });
    store.applyEvent({ type: 'order.created', order: order(2) });
    expect(store.entityMap()[order(1).id].status).toBe('preparing');
    expect(store.sorted()).toHaveLength(2);
    expect(store.highlightedIds()).toContain(order(1).id);

    jest.advanceTimersByTime(2500);
    expect(store.highlightedIds()).toEqual([]);
  });

  it('ignores menu events', () => {
    store.applyEvent({ type: 'resync' });
    expect(store.sorted()).toEqual([]);
  });

  it('shows an error when the first load fails with nothing on screen', async () => {
    api.list.mockReturnValue(throwError(() => ({ code: 'NETWORK', status: 0, retryable: true })));
    await store.loadFirstPage();
    expect(store.status()).toBe('error');
  });

  it('keeps the list when a refresh fails', async () => {
    api.list.mockReturnValueOnce(of({ items: [order(1)], nextCursor: null }));
    await store.loadFirstPage();
    api.list.mockReturnValueOnce(
      throwError(() => ({ code: 'NETWORK', status: 0, retryable: true })),
    );
    await store.loadFirstPage();
    expect(store.status()).toBe('ready');
    expect(store.sorted()).toHaveLength(1);
  });
});
