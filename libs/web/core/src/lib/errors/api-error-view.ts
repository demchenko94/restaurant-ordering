import { HttpErrorResponse } from '@angular/common/http';
import type { ErrorCode } from '@restaurant/contracts';

export type ApiErrorCode = ErrorCode | 'NETWORK' | 'TIMEOUT';

/** What the UI knows about a failed request, regardless of where it failed. */
export interface ApiErrorView {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly status: number;
  readonly details?: unknown;
  /** Server-generated id; shown to the user as a support reference. */
  readonly requestId?: string;
  /** True when repeating the same request may succeed. */
  readonly retryable: boolean;
}

export class RequestTimeoutError extends Error {
  constructor(readonly url: string) {
    super(`Request to ${url} timed out`);
    this.name = 'RequestTimeoutError';
  }
}

export function isApiErrorView(value: unknown): value is ApiErrorView {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'retryable' in value &&
    'status' in value
  );
}

interface ErrorEnvelope {
  code: ErrorCode;
  message: string;
  details?: unknown;
  requestId: string;
}

/** Light structural check of the server's error envelope (Zod stays out of the startup bundle). */
function readEnvelope(body: unknown): ErrorEnvelope | null {
  const error = (body as { error?: Partial<ErrorEnvelope> } | null)?.error;
  if (
    error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.requestId === 'string'
  ) {
    return error as ErrorEnvelope;
  }
  return null;
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);

/** Normalizes anything an HTTP call can throw into an {@link ApiErrorView}. */
export function toApiErrorView(error: unknown): ApiErrorView {
  if (isApiErrorView(error)) return error;

  if (error instanceof RequestTimeoutError) {
    return { code: 'TIMEOUT', message: error.message, status: 0, retryable: true };
  }

  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return { code: 'NETWORK', message: error.message, status: 0, retryable: true };
    }
    const envelope = readEnvelope(error.error);
    if (envelope) {
      const { code, message, details, requestId } = envelope;
      return {
        code,
        message,
        details,
        requestId,
        status: error.status,
        retryable: RETRYABLE_STATUS.has(error.status),
      };
    }
    return {
      code: 'INTERNAL',
      message: error.message,
      status: error.status,
      retryable: RETRYABLE_STATUS.has(error.status) || error.status >= 500,
    };
  }

  return {
    code: 'INTERNAL',
    message: error instanceof Error ? error.message : 'Unknown error',
    status: 0,
    retryable: false,
  };
}
