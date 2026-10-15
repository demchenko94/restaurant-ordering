import { DestroyRef, inject, Injectable, InjectionToken } from '@angular/core';
import { SERVER_EVENT_TYPES, type ServerEvent } from '@restaurant/contracts';
import { API_BASE_URL } from '../config';
import { ConnectionStore } from '../connection/connection.store';

type EventSourceFactory = (url: string) => EventSource;

/** Overridable in tests with a fake `EventSource`. */
export const EVENT_SOURCE_FACTORY = new InjectionToken<EventSourceFactory>('EVENT_SOURCE_FACTORY', {
  providedIn: 'root',
  factory: () => (url) => new EventSource(url),
});

const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 30_000;
const HIDDEN_PAUSE_MS = 60_000;

export type EventListenerFn = (event: ServerEvent) => void;

/**
 * Wraps `EventSource` for `GET /api/events`.
 *
 * The browser reconnects by itself and sends `Last-Event-ID`; this class adds connection state,
 * exponential backoff when the browser gives up, pause in background tabs, and a `reconnected`
 * hook so consumers can re-validate their data after a gap.
 */
@Injectable({ providedIn: 'root' })
export class SseClient {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly connection = inject(ConnectionStore);
  private readonly createSource = inject(EVENT_SOURCE_FACTORY);

  private source: EventSource | null = null;
  private backoffMs = BACKOFF_START_MS;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private paused = false;
  private hadConnection = false;
  private dropped = false;

  private readonly eventListeners = new Set<EventListenerFn>();
  private readonly reconnectListeners = new Set<() => void>();

  constructor() {
    if (typeof document !== 'undefined') {
      const onVisibility = () => this.onVisibilityChange();
      document.addEventListener('visibilitychange', onVisibility);
      inject(DestroyRef).onDestroy(() => {
        document.removeEventListener('visibilitychange', onVisibility);
        this.stop();
      });
    }
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.open();
  }

  stop(): void {
    this.started = false;
    this.close();
    this.clearTimers();
    this.connection.setSse('offline');
  }

  /** Receives every valid event. Returns an unsubscribe function. */
  onEvent(listener: EventListenerFn): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** Fires after the stream came back from a drop (or from a background pause). */
  onReconnect(listener: () => void): () => void {
    this.reconnectListeners.add(listener);
    return () => this.reconnectListeners.delete(listener);
  }

  private open(): void {
    this.close();
    this.connection.setSse(this.hadConnection ? 'reconnecting' : 'connecting');
    const source = this.createSource(`${this.baseUrl}/events`);
    this.source = source;

    source.onopen = () => {
      this.backoffMs = BACKOFF_START_MS;
      this.connection.setSse('live');
      if (this.hadConnection && this.dropped) {
        this.dropped = false;
        this.reconnectListeners.forEach((listener) => listener());
      }
      this.hadConnection = true;
    };

    source.onerror = () => {
      this.dropped = true;
      this.connection.setSse('reconnecting');
      // CLOSED means the browser gave up (for example a non-200 answer): reconnect ourselves.
      if (source.readyState === 2 /* CLOSED */ && this.started && !this.paused) {
        this.scheduleReopen();
      }
    };

    for (const name of SERVER_EVENT_TYPES) {
      source.addEventListener(name, (message) =>
        this.handle((message as MessageEvent<string>).data),
      );
    }
  }

  private handle(raw: string): void {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      console.warn('SSE: ignoring a frame that is not JSON');
      return;
    }
    // The stream is produced by our own server, typed by the shared contracts: a structural check
    // is enough (full Zod validation would put Zod into the startup bundle).
    const type = (json as { type?: unknown } | null)?.type;
    if (typeof type !== 'string' || !(SERVER_EVENT_TYPES as readonly string[]).includes(type)) {
      console.warn('SSE: ignoring an unknown event');
      return;
    }
    this.connection.markEvent();
    const event = json as ServerEvent;
    this.eventListeners.forEach((listener) => listener(event));
  }

  private scheduleReopen(): void {
    this.clearRetry();
    const delay = this.backoffMs + Math.random() * this.backoffMs * 0.3;
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX_MS);
    this.retryTimer = setTimeout(() => {
      if (this.started && !this.paused) this.open();
    }, delay);
  }

  private onVisibilityChange(): void {
    if (!this.started) return;
    if (document.hidden) {
      this.pauseTimer = setTimeout(() => {
        this.paused = true;
        this.dropped = true;
        this.close();
        this.clearRetry();
      }, HIDDEN_PAUSE_MS);
      return;
    }
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    if (this.paused) {
      this.paused = false;
      this.backoffMs = BACKOFF_START_MS;
      this.open();
    }
  }

  private close(): void {
    if (this.source) {
      this.source.onopen = null;
      this.source.onerror = null;
      this.source.close();
      this.source = null;
    }
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private clearTimers(): void {
    this.clearRetry();
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
  }
}
