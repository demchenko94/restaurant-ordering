import type { CheckoutQuote, Order } from '@restaurant/contracts';
import type { ApiErrorView } from '@restaurant/web/core';

export type CheckoutPhase =
  | 'idle'
  | 'quoting'
  | 'review'
  | 'confirming'
  | 'placed'
  /** The confirm request got no answer: the order may or may not exist. Retry with the same key. */
  | 'unknown'
  | 'failed';

export type CheckoutState = {
  phase: CheckoutPhase;
  quote: CheckoutQuote | null;
  /** A background re-quote is running (menu changed); the dialog keeps showing the last quote. */
  refreshing: boolean;
  error: ApiErrorView | null;
  order: Order | null;
  /** Created when review starts and kept across retries, so a retry can never duplicate the order. */
  idempotencyKey: string | null;
};

export const initialCheckoutState: CheckoutState = {
  phase: 'idle',
  quote: null,
  refreshing: false,
  error: null,
  order: null,
  idempotencyKey: null,
};

/** After a menu or cart change during review, wait this long before re-validating. */
export const REQUOTE_DEBOUNCE_MS = 300;
