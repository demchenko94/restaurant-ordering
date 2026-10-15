import { computed } from '@angular/core';
import {
  patchState,
  signalStoreFeature,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import type { ApiErrorView } from '../errors/api-error-view';

export type RequestStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RequestStatusState {
  status: RequestStatus;
  /** The last failure, kept while `status` is `ready` if a refresh failed but data is still shown. */
  error: ApiErrorView | null;
}

/**
 * Reusable "loading / ready / error" slice for stores that fetch data.
 *
 * `begin(hasData)` models stale-while-revalidate: with data on screen the status stays `ready`
 * (no spinner, no blank screen); without data it becomes `loading`. A failed refresh over
 * existing data keeps `ready` and only records the `error`.
 */
export function withRequestStatus() {
  return signalStoreFeature(
    withState<RequestStatusState>({ status: 'idle', error: null }),
    withComputed(({ status }) => ({
      isLoading: computed(() => status() === 'loading'),
      isReady: computed(() => status() === 'ready'),
      hasFailed: computed(() => status() === 'error'),
    })),
    withMethods((store) => ({
      beginRequest(hasData: boolean): void {
        patchState(store, { status: hasData ? 'ready' : 'loading', error: null });
      },
      completeRequest(): void {
        patchState(store, { status: 'ready', error: null });
      },
      failRequest(error: ApiErrorView, hasData: boolean): void {
        patchState(store, { status: hasData ? 'ready' : 'error', error });
      },
      markReady(): void {
        patchState(store, { status: 'ready' });
      },
    })),
  );
}
