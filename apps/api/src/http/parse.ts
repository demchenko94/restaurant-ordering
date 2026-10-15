import { Id } from '@restaurant/contracts';
import type { ZodType, z } from 'zod';
import { AppError } from './errors';

/** Parses untrusted input with a contract schema; failures become a 400 with issue details. */
export function parse<S extends ZodType>(schema: S, data: unknown, what = 'request'): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw AppError.validation(`Invalid ${what}`, result.error.issues);
  }
  return result.data;
}

export function parseId(value: unknown): string {
  return parse(Id, value, 'id');
}
