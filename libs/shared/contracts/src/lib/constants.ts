export const CURRENCY = 'USD';

/** Largest allowed unit price, in cents. */
export const MAX_PRICE_CENTS = 1_000_000;
export const MAX_QTY = 99;
export const MAX_LINES = 100;
/** Upper bound for any order amount (every line at max price and quantity). */
export const MAX_ORDER_TOTAL_CENTS = MAX_PRICE_CENTS * MAX_QTY * MAX_LINES;

export const CATEGORY_NAME_MAX = 60;
export const ITEM_NAME_MAX = 100;
export const ITEM_DESCRIPTION_MAX = 300;

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
