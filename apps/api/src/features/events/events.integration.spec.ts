import type { Category } from '@restaurant/contracts';
import request from 'supertest';
import { createApiHelpers } from '../../testing/api-helpers';
import { startTestApp, type TestApp } from '../../testing/test-app';

jest.setTimeout(120_000);

let t: TestApp;
const api = () => request(t.app);
const { createCategory, createFixedItem, placeOrder } = createApiHelpers(api);

beforeAll(async () => {
  t = await startTestApp();
});
afterAll(async () => {
  await t.stop();
});
beforeEach(async () => {
  await t.reset();
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
