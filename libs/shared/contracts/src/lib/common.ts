import { z } from 'zod';
import { MAX_ORDER_TOTAL_CENTS, MAX_PRICE_CENTS } from './constants';

export const Id = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');
export const IsoDate = z.iso.datetime();

/** Any non-negative amount of money in cents (totals, discounts). */
export const Cents = z.number().int().nonnegative().max(MAX_ORDER_TOTAL_CENTS);
/** A unit price in cents. Zero is not a valid price. */
export const PriceCents = z.number().int().min(1).max(MAX_PRICE_CENTS);

export const ErrorCode = z.enum([
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'CATEGORY_NOT_EMPTY',
  'DUPLICATE_NAME',
  'CART_CHANGED',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'INVALID_STATUS_TRANSITION',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  mongo: z.enum(['up', 'down']),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
