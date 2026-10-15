import type { MenuItem } from '@restaurant/contracts';
import request from 'supertest';
import { createApiHelpers } from '../../testing/api-helpers';
import { startTestApp, type TestApp } from '../../testing/test-app';

jest.setTimeout(120_000);

let t: TestApp;
const api = () => request(t.app);
const { createCategory, createFixedItem, createOpenItem } = createApiHelpers(api);

beforeAll(async () => {
  t = await startTestApp();
});
afterAll(async () => {
  await t.stop();
});
beforeEach(async () => {
  await t.reset();
});

describe('items', () => {
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
  it('returns 400 for malformed ids and 404 for unknown ones', async () => {
    await api().patch('/api/items/not-an-id').send({ available: true }).expect(400);
    await api()
      .patch(`/api/items/${'e'.repeat(24)}`)
      .send({ available: true })
      .expect(404);
  });
});
