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
