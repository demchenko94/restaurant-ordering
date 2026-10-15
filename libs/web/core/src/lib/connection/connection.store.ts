import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';

export type SseState = 'connecting' | 'live' | 'reconnecting' | 'offline';
export type Health = 'ok' | 'degraded' | 'offline';

interface ConnectionState {
  sse: SseState;
  online: boolean;
  lastEventAt: number | null;
}

export const ConnectionStore = signalStore(
  { providedIn: 'root' },
  withState<ConnectionState>({
    sse: 'connecting',
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    lastEventAt: null,
  }),
  withComputed(({ sse, online }) => ({
    health: computed<Health>(() => {
      if (!online()) return 'offline';
      return sse() === 'live' ? 'ok' : 'degraded';
    }),
    /** Writes are pointless while the browser reports no network. */
    canWrite: computed(() => online()),
  })),
  withMethods((store) => ({
    setSse: (sse: SseState) => patchState(store, { sse }),
    setOnline: (online: boolean) => patchState(store, { online }),
    markEvent: () => patchState(store, { lastEventAt: Date.now() }),
  })),
  withHooks({
    onInit(store) {
      if (typeof window === 'undefined') return;
      const up = () => store.setOnline(true);
      const down = () => store.setOnline(false);
      window.addEventListener('online', up);
      window.addEventListener('offline', down);
    },
  }),
);
