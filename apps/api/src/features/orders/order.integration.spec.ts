import type { Order } from '@restaurant/contracts';
import request from 'supertest';
import { createApiHelpers } from '../../testing/api-helpers';
import { startTestApp, type TestApp } from '../../testing/test-app';

jest.setTimeout(120_000);

let t: TestApp;
const api = () => request(t.app);
const { createCategory, createFixedItem, createOpenItem, placeOrder } = createApiHelpers(api);

beforeAll(async () => {
  t = await startTestApp();
});
afterAll(async () => {
  await t.stop();
});
beforeEach(async () => {
  await t.reset();
});

describe('orders', () => {
  async function setup() {
    const category = await createCategory();
    const pizza = await createFixedItem(category.id);
    const special = await createOpenItem(category.id);
    return { category, pizza, special };
  }

  it('places an order with server-side prices and a discount', async () => {
    const { pizza, special } = await setup();
    const res = await placeOrder({
      lines: [
        { itemId: pizza.id, quantity: 2, expectedUnitPriceCents: 950 },
        { itemId: special.id, quantity: 1, unitPriceCents: 1500 },
      ],
      discountCents: 400,
    }).expect(201);
    const order: Order = res.body;
    expect(res.headers['idempotency-replayed']).toBe('false');
    expect(order).toMatchObject({
      number: 1,
      status: 'placed',
      subtotalCents: 3400,
      discountCents: 400,
      totalCents: 3000,
    });
    expect(order.lines.map((l) => l.name)).toEqual(['Margherita', 'Chef special']);
  });

  it('requires a valid Idempotency-Key header', async () => {
    const { pizza } = await setup();
    const body = { lines: [{ itemId: pizza.id, quantity: 1 }] };
    const missing = await api().post('/api/orders').send(body).expect(400);
    expect(missing.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    const invalid = await api()
      .post('/api/orders')
      .set('Idempotency-Key', 'bad key!')
      .send(body)
      .expect(400);
    expect(invalid.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('never places the same order twice: same key replays the original', async () => {
    const { pizza } = await setup();
    const body = { lines: [{ itemId: pizza.id, quantity: 1 }] };
    const first = await placeOrder(body, 'same-key').expect(201);
    const second = await placeOrder(body, 'same-key').expect(200);
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(second.body.id).toBe(first.body.id);

    const list = await api().get('/api/orders').expect(200);
    expect(list.body.items).toHaveLength(1);
  });

  it('creates exactly one order for concurrent requests with the same key', async () => {
    const { pizza } = await setup();
    const body = { lines: [{ itemId: pizza.id, quantity: 1 }] };
    const results = await Promise.all(
      Array.from({ length: 8 }, () => placeOrder(body, 'race-key')),
    );
    expect(results.every((r) => r.status === 201 || r.status === 200)).toBe(true);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    const list = await api().get('/api/orders').expect(200);
    expect(list.body.items).toHaveLength(1);
  });

  it('rejects a reused key with a different body (422)', async () => {
    const { pizza } = await setup();
    await placeOrder({ lines: [{ itemId: pizza.id, quantity: 1 }] }, 'k').expect(201);
    const res = await placeOrder({ lines: [{ itemId: pizza.id, quantity: 2 }] }, 'k').expect(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('refuses with CART_CHANGED when an item became unavailable, and creates nothing', async () => {
    const { pizza } = await setup();
    await api().patch(`/api/items/${pizza.id}`).send({ available: false }).expect(200);
    const res = await placeOrder({ lines: [{ itemId: pizza.id, quantity: 1 }] }).expect(409);
    expect(res.body.error.code).toBe('CART_CHANGED');
    expect(res.body.error.details).toEqual([{ type: 'ITEM_UNAVAILABLE', itemId: pizza.id }]);
    const list = await api().get('/api/orders').expect(200);
    expect(list.body.items).toHaveLength(0);
  });

  it('refuses when the price changed after the user saw it', async () => {
    const { pizza } = await setup();
    await api().patch(`/api/items/${pizza.id}`).send({ priceCents: 1200 }).expect(200);
    const res = await placeOrder({
      lines: [{ itemId: pizza.id, quantity: 1, expectedUnitPriceCents: 950 }],
    }).expect(409);
    expect(res.body.error.details[0]).toMatchObject({ type: 'PRICE_CHANGED', currentCents: 1200 });
  });

  it('refuses a discount above the subtotal', async () => {
    const { pizza } = await setup();
    const res = await placeOrder({
      lines: [{ itemId: pizza.id, quantity: 1 }],
      discountCents: 951,
    }).expect(409);
    expect(res.body.error.details).toEqual([{ type: 'DISCOUNT_TOO_HIGH', maxCents: 950 }]);
  });

  it('keeps the price snapshot when the menu changes later', async () => {
    const { pizza } = await setup();
    const placed = await placeOrder({ lines: [{ itemId: pizza.id, quantity: 1 }] }).expect(201);
    await api()
      .patch(`/api/items/${pizza.id}`)
      .send({ priceCents: 5000, name: 'Renamed' })
      .expect(200);
    await api().delete(`/api/items/${pizza.id}`).expect(204);
    const order = await api().get(`/api/orders/${placed.body.id}`).expect(200);
    expect(order.body.lines[0]).toMatchObject({ name: 'Margherita', unitPriceCents: 950 });
  });

  it('paginates newest first with an opaque cursor', async () => {
    const { pizza } = await setup();
    for (let i = 0; i < 5; i++) {
      await placeOrder({ lines: [{ itemId: pizza.id, quantity: 1 }] }).expect(201);
    }
    const page1 = await api().get('/api/orders?limit=2').expect(200);
    expect(page1.body.items.map((o: Order) => o.number)).toEqual([5, 4]);
    const page2 = await api()
      .get(`/api/orders?limit=2&cursor=${page1.body.nextCursor}`)
      .expect(200);
    expect(page2.body.items.map((o: Order) => o.number)).toEqual([3, 2]);
    const page3 = await api()
      .get(`/api/orders?limit=2&cursor=${page2.body.nextCursor}`)
      .expect(200);
    expect(page3.body.items.map((o: Order) => o.number)).toEqual([1]);
    expect(page3.body.nextCursor).toBeNull();
    await api().get('/api/orders?cursor=garbage').expect(400);
  });

  it('follows the status machine and rejects invalid moves', async () => {
    const { pizza } = await setup();
    const placed = await placeOrder({ lines: [{ itemId: pizza.id, quantity: 1 }] }).expect(201);
    const id = placed.body.id;

    const bad = await api()
      .patch(`/api/orders/${id}/status`)
      .send({ status: 'completed' })
      .expect(409);
    expect(bad.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    for (const status of ['preparing', 'ready', 'completed']) {
      const res = await api().patch(`/api/orders/${id}/status`).send({ status }).expect(200);
      expect(res.body.status).toBe(status);
    }
    await api().patch(`/api/orders/${id}/status`).send({ status: 'cancelled' }).expect(409);
  });
});
