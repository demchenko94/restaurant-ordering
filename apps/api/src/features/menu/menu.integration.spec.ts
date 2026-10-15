import type { Category } from '@restaurant/contracts';
import request from 'supertest';
import { createApiHelpers } from '../../testing/api-helpers';
import { startTestApp, type TestApp } from '../../testing/test-app';

jest.setTimeout(120_000);

let t: TestApp;
const api = () => request(t.app);
const { createCategory, createFixedItem } = createApiHelpers(api);

beforeAll(async () => {
  t = await startTestApp();
});
afterAll(async () => {
  await t.stop();
});
beforeEach(async () => {
  await t.reset();
});

describe('menu snapshot', () => {
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
});
