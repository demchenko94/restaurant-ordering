import { HttpErrorResponse } from '@angular/common/http';
import { describeError, errorSummary } from './error-messages';
import { RequestTimeoutError, toApiErrorView } from './api-error-view';

const envelope = (code: string, status: number) =>
  new HttpErrorResponse({
    status,
    error: { error: { code, message: 'server says no', requestId: 'req-12345678', details: [1] } },
  });

describe('toApiErrorView', () => {
  it('maps the server envelope', () => {
    const view = toApiErrorView(envelope('CART_CHANGED', 409));
    expect(view).toMatchObject({
      code: 'CART_CHANGED',
      message: 'server says no',
      status: 409,
      requestId: 'req-12345678',
      retryable: false,
    });
  });

  it('treats status 0 as a retryable network error', () => {
    const view = toApiErrorView(new HttpErrorResponse({ status: 0 }));
    expect(view).toMatchObject({ code: 'NETWORK', retryable: true });
  });

  it('treats timeouts as retryable', () => {
    expect(toApiErrorView(new RequestTimeoutError('/api/menu'))).toMatchObject({
      code: 'TIMEOUT',
      retryable: true,
    });
  });

  it('marks gateway errors without an envelope as retryable INTERNAL', () => {
    const view = toApiErrorView(new HttpErrorResponse({ status: 503, error: '<html>' }));
    expect(view).toMatchObject({ code: 'INTERNAL', retryable: true, status: 503 });
  });

  it('is idempotent', () => {
    const view = toApiErrorView(envelope('NOT_FOUND', 404));
    expect(toApiErrorView(view)).toBe(view);
  });

  it('wraps unknown throwables', () => {
    expect(toApiErrorView(new Error('boom'))).toMatchObject({ code: 'INTERNAL', message: 'boom' });
    expect(toApiErrorView('weird')).toMatchObject({ code: 'INTERNAL' });
  });
});

describe('error messages', () => {
  it('has a user-facing message and recovery action for network errors', () => {
    const view = toApiErrorView(new HttpErrorResponse({ status: 0 }));
    expect(describeError(view)).toMatchObject({ action: 'Retry' });
  });

  it('adds a short reference to snackbar summaries', () => {
    const summary = errorSummary(toApiErrorView(envelope('INTERNAL', 500)));
    expect(summary).toContain('Something went wrong on our side');
    expect(summary).toContain('ref req-1234');
  });
});
