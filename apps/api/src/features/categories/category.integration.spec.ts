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

describe('categories', () => {
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
  it('refuses to delete a category with items, then deletes it once empty', async () => {
    const category = await createCategory();
    const item = await createFixedItem(category.id);
    const res = await api().delete(`/api/categories/${category.id}`).expect(409);
    expect(res.body.error.code).toBe('CATEGORY_NOT_EMPTY');

    await api().delete(`/api/items/${item.id}`).expect(204);
    await api().delete(`/api/categories/${category.id}`).expect(204);
    await api().delete(`/api/items/${item.id}`).expect(404);
  });
});
