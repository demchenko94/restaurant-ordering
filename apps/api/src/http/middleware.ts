import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { AppError } from './errors';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
  }
}

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && /^[\w.-]{1,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

function toAppError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) return AppError.validation('Invalid request', error.issues);
  const e = error as { type?: string; status?: number } | null;
  // body-parser: malformed JSON, oversized body, unsupported charset...
  if (e?.type === 'entity.parse.failed') return AppError.validation('Malformed JSON body');
  if (e?.type === 'entity.too.large') {
    return new AppError(413, 'VALIDATION_FAILED', 'Request body is too large');
  }
  return null;
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const known = toAppError(error);
    if (!known) {
      logger.error({ err: error, requestId: req.requestId }, 'unhandled error');
    }
    const status = known?.status ?? 500;
    res.status(status).json({
      error: {
        code: known?.code ?? 'INTERNAL',
        message: known?.message ?? 'Something went wrong on our side',
        ...(known?.details !== undefined ? { details: known.details } : {}),
        requestId: req.requestId,
      },
    });
  };
}
