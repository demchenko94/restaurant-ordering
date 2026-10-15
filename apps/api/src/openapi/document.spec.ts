import { buildOpenApiDocument } from './document';

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument();

  it('describes every REST endpoint', () => {
    expect(Object.keys(doc.paths ?? {}).sort()).toEqual(
      [
        '/api/categories',
        '/api/categories/{id}',
        '/api/checkout/quote',
        '/api/events',
        '/api/health',
        '/api/items',
        '/api/items/{id}',
        '/api/menu',
        '/api/orders',
        '/api/orders/{id}',
        '/api/orders/{id}/status',
      ].sort(),
    );
  });

  it('registers shared component schemas', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining(['Category', 'MenuItem', 'MenuSnapshot', 'Order', 'ApiError']),
    );
  });
});
