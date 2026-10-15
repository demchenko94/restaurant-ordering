import { TestBed } from '@angular/core/testing';
import { signalStore } from '@ngrx/signals';
import { withRequestStatus } from './with-request-status';

const TestStore = signalStore({ providedIn: 'root' }, withRequestStatus());

describe('withRequestStatus', () => {
  let store: InstanceType<typeof TestStore>;
  const error = { code: 'NETWORK', message: 'x', status: 0, retryable: true } as const;

  beforeEach(() => {
    store = TestBed.inject(TestStore);
  });

  it('starts idle', () => {
    expect(store.status()).toBe('idle');
    expect(store.error()).toBeNull();
  });

  it('shows loading only when there is nothing to show yet', () => {
    store.beginRequest(false);
    expect(store.isLoading()).toBe(true);
    store.beginRequest(true);
    expect(store.status()).toBe('ready');
  });

  it('completes and clears the error', () => {
    store.failRequest(error, false);
    store.beginRequest(false);
    store.completeRequest();
    expect(store.isReady()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('fails hard without data, softly with data', () => {
    store.failRequest(error, false);
    expect(store.hasFailed()).toBe(true);
    store.failRequest(error, true);
    expect(store.status()).toBe('ready');
    expect(store.error()?.code).toBe('NETWORK');
  });
});
