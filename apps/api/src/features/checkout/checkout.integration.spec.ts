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
