import type { ApiErrorView } from './api-error-view';

export interface ErrorPresentation {
  title: string;
  /** Short call to action for a retry/recovery button, if one makes sense. */
  action?: string;
}

const MESSAGES: Record<ApiErrorView['code'], ErrorPresentation> = {
  NETWORK: { title: "Can't reach the server. Check your connection.", action: 'Retry' },
  TIMEOUT: { title: 'The server took too long to respond.', action: 'Retry' },
  CART_CHANGED: { title: 'Some items changed while you were ordering.', action: 'Review changes' },
  VALIDATION_FAILED: { title: 'Please check the highlighted fields.' },
  CATEGORY_NOT_EMPTY: { title: 'Move or delete the items in this category first.' },
  DUPLICATE_NAME: { title: 'A category with this name already exists.' },
  IDEMPOTENCY_KEY_REQUIRED: { title: 'Something went wrong. Please start checkout again.' },
  IDEMPOTENCY_KEY_REUSED: {
    title: 'Something went wrong. Please start checkout again.',
    action: 'Restart checkout',
  },
  INVALID_STATUS_TRANSITION: { title: 'That status change is not allowed.' },
  NOT_FOUND: { title: 'That item no longer exists.' },
  INTERNAL: { title: 'Something went wrong on our side.', action: 'Retry' },
};

export function describeError(error: ApiErrorView): ErrorPresentation & { reference?: string } {
  const presentation = MESSAGES[error.code];
  return error.requestId ? { ...presentation, reference: error.requestId } : presentation;
}

/** One line suitable for a snackbar. */
export function errorSummary(error: ApiErrorView): string {
  const { title, reference } = describeError(error);
  return reference ? `${title} (ref ${reference.slice(0, 8)})` : title;
}
