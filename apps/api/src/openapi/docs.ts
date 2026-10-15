import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './document';

export function mountDocs(app: Express): void {
  const document = buildOpenApiDocument();
  app.get('/api/openapi.json', (_req, res) => {
    res.json(document);
  });
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(document, { customSiteTitle: 'Restaurant Ordering API' }),
  );
}
