import type { Category, MenuItem, Order } from '@restaurant/contracts';
import request from 'supertest';
import { startTestApp, type TestApp } from './testing/test-app';

jest.setTimeout(120_000);

let t: TestApp;
const api = () => request(t.app);

beforeAll(async () => {
  t = await startTestApp();
});
afterAll(async () => {
  await t.stop();
});
beforeEach(async () => {
  await t.reset();
});

async function createCategory(name = 'Pizza'): Promise<Category> {
  const res = await api().post('/api/categories').send({ name }).expect(201);
  return res.body;
}
async function createFixedItem(categoryId: string, name = 'Margherita', priceCents = 950) {
  const res = await api()
    .post('/api/items')
    .send({ categoryId, name, openPrice: false, priceCents })
    .expect(201);
  return res.body as MenuItem;
}
async function createOpenItem(categoryId: string, name = 'Chef special') {
  const res = await api()
    .post('/api/items')
    .send({ categoryId, name, openPrice: true })
    .expect(201);
  return res.body as MenuItem;
}
let keyCounter = 0;
const newKey = () => `test-key-${++keyCounter}`;
const placeOrder = (body: object, key = newKey()) =>
  api().post('/api/orders').set('Idempotency-Key', key).send(body);

describe('system', () => {
  it('reports health', async () => {
    const res = await api().get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', mongo: 'up' });
  });

  it('answers unknown routes with the error envelope and a request id', async () => {
    const res = await api().get('/api/nope').set('X-Request-Id', 'req-123').expect(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', requestId: 'req-123' });
    expect(res.headers['x-request-id']).toBe('req-123');
  });

  it('rejects malformed JSON with a 400 envelope', async () => {
    const res = await api()
      .post('/api/categories')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('serves the OpenAPI document and Swagger UI', async () => {
    const doc = await api().get('/api/openapi.json').expect(200);
    expect(doc.body.openapi).toBe('3.1.0');
    await api().get('/api/docs/').expect(200);
  });
});

describe('menu', () => {
  it('creates categories and rejects duplicate names case-insensitively', async () => {
    await createCategory('Pizza');
    const res = await api().post('/api/categories').send({ name: 'pizza' }).expect(409);
    expect(res.body.error.code).toBe('DUPLICATE_NAME');
  });

  it('validates input with field details', async () => {
    const res = await api().post('/api/categories').send({ name: '   ' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('returns a snapshot with a revision that grows on every mutation', async () => {
    const empty = await api().get('/api/menu').expect(200);
    expect(empty.body.revision).toBe(0);

    const category = await createCategory();
    const item = await createFixedItem(category.id);
    await api().patch(`/api/items/${item.id}`).send({ available: false }).expect(200);

    const snapshot = await api().get('/api/menu').expect(200);
    expect(snapshot.body.revision).toBe(3);
    expect(snapshot.body.categories).toHaveLength(1);
    expect(snapshot.body.items[0]).toMatchObject({ name: 'Margherita', available: false });
  });

  it('supports conditional requests with the revision ETag', async () => {
    await createCategory();
    const first = await api().get('/api/menu').expect(200);
    const etag = first.headers['etag'];
    expect(etag).toBe('"rev-1"');
    await api().get('/api/menu').set('If-None-Match', etag).expect(304);
    await createCategory('Pasta');
    await api().get('/api/menu').set('If-None-Match', etag).expect(200);
  });

  it('enforces the open-price invariant on create', async () => {
    const category = await createCategory();
    await api()
      .post('/api/items')
      .send({ categoryId: category.id, name: 'X', openPrice: false })
      .expect(400);
    const open = await createOpenItem(category.id);
    expect(open).toMatchObject({ openPrice: true, priceCents: null });
  });

  it('rejects items for unknown categories', async () => {
    const res = await api()
      .post('/api/items')
      .send({ categoryId: 'f'.repeat(24), name: 'X', openPrice: true })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('switches an item to open price (clears price) and back (requires price)', async () => {
    const category = await createCategory();
    const item = await createFixedItem(category.id);

    const open = await api().patch(`/api/items/${item.id}`).send({ openPrice: true }).expect(200);
    expect(open.body).toMatchObject({ openPrice: true, priceCents: null });

    await api().patch(`/api/items/${item.id}`).send({ openPrice: false }).expect(400);
    const fixed = await api()
      .patch(`/api/items/${item.id}`)
      .send({ openPrice: false, priceCents: 700 })
      .expect(200);
    expect(fixed.body).toMatchObject({ openPrice: false, priceCents: 700 });
  });

  it('refuses to delete a category with items, then deletes it once empty', async () => {
    const category = await createCategory();
    const item = await createFixedItem(category.id);
    const res = await api().delete(`/api/categories/${category.id}`).expect(409);
    expect(res.body.error.code).toBe('CATEGORY_NOT_EMPTY');

    await api().delete(`/api/items/${item.id}`).expect(204);
    await api().delete(`/api/categories/${category.id}`).expect(204);
    await api().delete(`/api/items/${item.id}`).expect(404);
  });

  it('returns 400 for malformed ids and 404 for unknown ones', async () => {
    await api().patch('/api/items/not-an-id').send({ available: true }).expect(400);
    await api()
      .patch(`/api/items/${'e'.repeat(24)}`)
      .send({ available: true })
      .expect(404);
  });
});

describe('checkout quote', () => {
  it('prices a cart and reports changes as data with status 200', async () => {
    const category = await createCategory();
    const item = await createFixedItem(category.id);
    await api().patch(`/api/items/${item.id}`).send({ priceCents: 1000 }).expect(200);

    const res = await api()
      .post('/api/checkout/quote')
      .send({ lines: [{ itemId: item.id, quantity: 2, expectedUnitPriceCents: 950 }] })
      .expect(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.changes).toEqual([
      { type: 'PRICE_CHANGED', itemId: item.id, previousCents: 950, currentCents: 1000 },
    ]);
    expect(res.body.totalCents).toBe(2000);
    expect(res.body.menuRevision).toBe(3);
  });
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

describe('realtime (SSE)', () => {
  async function readEvents(url: string, headers: Record<string, string>, until: number) {
    const controller = new AbortController();
    const res = await fetch(`${url}/api/events`, { headers, signal: controller.signal });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const decoder = new TextDecoder();
    const reader = res.body!.getReader();
    let buffer = '';
    const events: { id?: string; event?: string; data?: string }[] = [];
    const deadline = Date.now() + 5000;
    while (events.length < until && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const fields = Object.fromEntries(
          frame
            .split('\n')
            .filter((l) => l.includes(': ') && !l.startsWith(':'))
            .map((l) => [l.slice(0, l.indexOf(': ')), l.slice(l.indexOf(': ') + 2)]),
        );
        if (fields['event'] || fields['data']) events.push(fields);
      }
    }
    controller.abort();
    return events;
  }

  it('pushes menu changes to connected clients with a revision', async () => {
    const server = await t.listen();
    try {
      const category = await createCategory();
      const pending = readEvents(server.url, {}, 1);
      await new Promise((r) => setTimeout(r, 200));
      await createFixedItem(category.id);
      const [event] = await pending;
      expect(event.event).toBe('menu.item.upserted');
      expect(JSON.parse(event.data as string)).toMatchObject({
        type: 'menu.item.upserted',
        revision: 2,
        item: { name: 'Margherita' },
      });
    } finally {
      await server.close();
    }
  });

  it('replays missed events from Last-Event-ID and asks for resync on unknown ids', async () => {
    const server = await t.listen();
    try {
      const first = t.container.bus.publish({
        type: 'menu.item.deleted',
        revision: 1,
        id: 'a'.repeat(24),
      });
      t.container.bus.publish({ type: 'menu.item.deleted', revision: 2, id: 'b'.repeat(24) });
      t.container.bus.publish({ type: 'menu.item.deleted', revision: 3, id: 'c'.repeat(24) });

      const replayed = await readEvents(server.url, { 'Last-Event-ID': first.id }, 2);
      expect(replayed.map((e) => JSON.parse(e.data as string).revision)).toEqual([2, 3]);

      const resync = await readEvents(server.url, { 'Last-Event-ID': 'stale-9' }, 1);
      expect(resync[0].event).toBe('resync');
    } finally {
      await server.close();
    }
  });

  it('emits order.created and order.updated', async () => {
    const server = await t.listen();
    try {
      const category = await createCategory();
      const pizza = await createFixedItem(category.id);
      const pending = readEvents(server.url, {}, 2);
      await new Promise((r) => setTimeout(r, 200));
      const placed = await placeOrder({ lines: [{ itemId: pizza.id, quantity: 1 }] }).expect(201);
      await api()
        .patch(`/api/orders/${placed.body.id}/status`)
        .send({ status: 'preparing' })
        .expect(200);
      const events = await pending;
      expect(events.map((e) => e.event)).toEqual(['order.created', 'order.updated']);
    } finally {
      await server.close();
    }
  });
});
