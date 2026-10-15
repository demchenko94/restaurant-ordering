import { TestBed } from '@angular/core/testing';
import type { ServerEvent } from '@restaurant/contracts';
import { ConnectionStore } from '../connection/connection.store';
import { EVENT_SOURCE_FACTORY, SseClient } from './sse-client';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, ((e: MessageEvent<string>) => void)[]>();
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(name: string, fn: (e: MessageEvent<string>) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  emit(name: string, data: unknown) {
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    this.listeners.get(name)?.forEach((fn) => fn({ data: raw } as MessageEvent<string>));
  }
  fail(readyState: number) {
    this.readyState = readyState;
    this.onerror?.();
  }
}

describe('SseClient', () => {
  let client: SseClient;
  let connection: InstanceType<typeof ConnectionStore>;
  const latest = () => FakeEventSource.instances[FakeEventSource.instances.length - 1];

  beforeEach(() => {
    jest.useFakeTimers();
    FakeEventSource.instances = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: EVENT_SOURCE_FACTORY, useValue: (url: string) => new FakeEventSource(url) },
      ],
    });
    client = TestBed.inject(SseClient);
    connection = TestBed.inject(ConnectionStore);
  });

  afterEach(() => {
    client.stop();
    jest.useRealTimers();
  });

  it('connects to the events endpoint and reports connection state', () => {
    client.start();
    expect(latest().url).toBe('/api/events');
    expect(connection.sse()).toBe('connecting');
    latest().open();
    expect(connection.sse()).toBe('live');
  });

  it('delivers valid events and ignores garbage', () => {
    const received: ServerEvent[] = [];
    client.onEvent((e) => received.push(e));
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    client.start();
    latest().emit('menu.item.deleted', {
      type: 'menu.item.deleted',
      revision: 2,
      id: 'a'.repeat(24),
    });
    latest().emit('menu.item.deleted', 'not json');
    latest().emit('menu.item.deleted', { type: 'bogus' });
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('menu.item.deleted');
    expect(connection.lastEventAt()).not.toBeNull();
    warn.mockRestore();
  });

  it('shows reconnecting while the browser retries by itself', () => {
    client.start();
    latest().open();
    latest().fail(0 /* CONNECTING: the browser is retrying */);
    expect(connection.sse()).toBe('reconnecting');
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('opens a fresh connection with backoff when the browser gives up, then notifies', async () => {
    const reconnected = jest.fn();
    client.onReconnect(reconnected);
    client.start();
    latest().open();

    latest().fail(2 /* CLOSED */);
    expect(FakeEventSource.instances).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1500);
    expect(FakeEventSource.instances).toHaveLength(2);

    latest().open();
    expect(connection.sse()).toBe('live');
    expect(reconnected).toHaveBeenCalledTimes(1);
  });

  it('does not fire reconnect for the very first connection', () => {
    const reconnected = jest.fn();
    client.onReconnect(reconnected);
    client.start();
    latest().open();
    expect(reconnected).not.toHaveBeenCalled();
  });

  it('stop() closes the stream and goes offline', () => {
    client.start();
    const source = latest();
    client.stop();
    expect(source.closed).toBe(true);
    expect(connection.sse()).toBe('offline');
  });
});
