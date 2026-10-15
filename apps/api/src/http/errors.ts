import type { ErrorCode } from '@restaurant/contracts';

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(what: string): AppError {
    return new AppError(404, 'NOT_FOUND', `${what} not found`);
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(400, 'VALIDATION_FAILED', message, details);
  }
}
