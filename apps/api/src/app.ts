import './openapi/extend';
import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { errorHandler, notFoundHandler, requestId } from './http/middleware';
import { createApiRouter, type Services } from './http/routes';
import { mountDocs } from './openapi/docs';

export interface AppOptions {
  services: Services;
  logger: Logger;
  corsOrigin?: string;
}

export function createApp({ services, logger, corsOrigin }: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      autoLogging: { ignore: (req) => req.url === '/api/events' || req.url === '/api/health' },
    }),
  );
  // Swagger UI loads inline scripts and styles, so the CSP is relaxed for /api/docs only.
  app.use(helmet({ contentSecurityPolicy: false }));
  if (corsOrigin) {
    app.use('/api', cors({ origin: corsOrigin }));
  }
  // Compression would buffer the event stream.
  app.use(
    compression({
      filter: (req, res) => !req.path.endsWith('/events') && compression.filter(req, res),
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  mountDocs(app);
  app.use('/api', createApiRouter(services));
  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
