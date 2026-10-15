import type { Category, MenuItem } from '@restaurant/contracts';
/** Small REST helpers shared by the feature integration tests. `api` is resolved lazily. */
export function createApiHelpers(api: () => ReturnType<typeof import('supertest')>) {
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

  return { createCategory, createFixedItem, createOpenItem, newKey, placeOrder };
}
