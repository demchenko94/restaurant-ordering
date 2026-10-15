import { effect } from '@angular/core';
import { getState, patchState, signalStoreFeature, type, withHooks } from '@ngrx/signals';

export interface StorageSyncOptions<State extends object> {
  /** `localStorage` key. Bump its version suffix when the persisted shape changes. */
  key: string;
  /** Picks what to persist. Defaults to the whole state. */
  serialize?: (state: State) => unknown;
  /**
   * Turns whatever was read from storage into a state patch, or `null` to ignore it. Storage is
   * untrusted (old versions, manual edits), so this must validate.
   */
  restore: (raw: unknown) => Partial<State> | null;
}

/**
 * Keeps a slice of the store in `localStorage`: restored once on init, written on every change.
 * Storage failures (private mode, quota) are swallowed: the store keeps working in memory.
 */
export function withStorageSync<State extends object>(options: StorageSyncOptions<State>) {
  return signalStoreFeature(
    { state: type<State>() },
    withHooks({
      onInit(store) {
        try {
          const raw = localStorage.getItem(options.key);
          const restored = raw ? options.restore(JSON.parse(raw)) : null;
          if (restored) patchState(store, restored);
        } catch {
          // Corrupt or inaccessible storage: start from the default state.
        }

        effect(() => {
          const state = getState(store) as State;
          try {
            localStorage.setItem(
              options.key,
              JSON.stringify(options.serialize ? options.serialize(state) : state),
            );
          } catch {
            // Storage is only a convenience.
          }
        });
      },
    }),
  );
}
