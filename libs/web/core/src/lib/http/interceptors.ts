import {
  type HttpEvent,
  type HttpHandlerFn,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { catchError, Observable, retry, throwError, timeout, timer } from 'rxjs';
import { RequestTimeoutError, toApiErrorView } from '../errors/api-error-view';

/** Adds a correlation id so a failure shown to the user can be found in server logs. */
export const requestIdInterceptor: HttpInterceptorFn = (req, next) =>
  next(
    req.headers.has('X-Request-Id')
      ? req
      : req.clone({ setHeaders: { 'X-Request-Id': crypto.randomUUID() } }),
  );

const DEFAULT_TIMEOUT_MS = 10_000;
const ORDER_TIMEOUT_MS = 15_000;

export const timeoutInterceptor: HttpInterceptorFn = (req, next) => {
  const limit =
    req.method === 'POST' && req.url.endsWith('/orders') ? ORDER_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  return next(req).pipe(
    // `each`, not `first`: real backends emit a `Sent` event right away, which would end a
    // `first` timer; `each` then bounds the wait for the response (or the next progress event).
    timeout({
      each: limit,
      with: () => throwError(() => new RequestTimeoutError(req.url)),
    }),
  );
};

export const RETRY_DELAYS_MS = [300, 900] as const;

/**
 * Retries idempotent reads only. Writes are never retried automatically: the checkout state
 * machine retries `POST /orders` itself, with the same idempotency key.
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') return next(req);
  return next(req).pipe(
    retry({
      count: RETRY_DELAYS_MS.length,
      delay: (error, attempt) => {
        const view = toApiErrorView(error);
        if (!view.retryable) return throwError(() => error);
        const base = RETRY_DELAYS_MS[attempt - 1] ?? 1000;
        return timer(base + Math.random() * base * 0.3);
      },
    }),
  );
};

/** Last in the chain: everything that escapes is an {@link ApiErrorView}. */
export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> =>
  next(req).pipe(catchError((error: unknown) => throwError(() => toApiErrorView(error))));
