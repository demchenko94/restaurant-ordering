import { TestBed } from '@angular/core/testing';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { withStorageSync } from './with-storage-sync';

interface State {
  count: number;
  transient: string;
}

const KEY = 'test.sync.v1';

const makeStore = () =>
  signalStore(
    { providedIn: 'root' },
    withState<State>({ count: 0, transient: 'x' }),
    withMethods((store) => ({
      setCount: (count: number) => patchState(store, { count }),
    })),
    withStorageSync<State>({
      key: KEY,
      serialize: (s) => ({ count: s.count }),
      restore: (raw) => {
        const count = (raw as { count?: unknown } | null)?.count;
        return Number.isInteger(count) ? { count: count as number } : null;
      },
    }),
  );

describe('withStorageSync', () => {
  beforeEach(() => localStorage.clear());

  it('restores valid persisted data on init', () => {
    localStorage.setItem(KEY, JSON.stringify({ count: 7 }));
    const store = TestBed.inject(makeStore());
    expect(store.count()).toBe(7);
    expect(store.transient()).toBe('x');
  });

  it('ignores invalid or corrupt data', () => {
    localStorage.setItem(KEY, JSON.stringify({ count: 'nope' }));
    expect(TestBed.inject(makeStore()).count()).toBe(0);

    TestBed.resetTestingModule();
    localStorage.setItem(KEY, '{broken');
    expect(TestBed.inject(makeStore()).count()).toBe(0);
  });

  it('writes only the serialized slice on every change', () => {
    const store = TestBed.inject(makeStore());
    store.setCount(3);
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({ count: 3 });
  });
});
