import type { ServerEvent } from '@restaurant/contracts';

export interface StampedEvent {
  /** `<epoch>-<seq>`; the epoch changes on every server start, so stale ids are detectable. */
  id: string;
  event: ServerEvent;
}

export type ReplayResult =
  | { kind: 'events'; events: StampedEvent[] }
  /** The requested id is unknown or fell out of the buffer: the client must reload. */
  | { kind: 'resync' };

type Listener = (stamped: StampedEvent) => void;

/**
 * In-process publish/subscribe with a bounded ring buffer for `Last-Event-ID` replay.
 * Production note: with several API instances this becomes MongoDB Change Streams
 * or a message broker.
 */
export class EventBus {
  private readonly epoch = Date.now().toString(36);
  private seq = 0;
  private readonly buffer: StampedEvent[] = [];
  private readonly listeners = new Set<Listener>();

  constructor(private readonly capacity = 500) {}

  publish(event: ServerEvent): StampedEvent {
    const stamped: StampedEvent = { id: `${this.epoch}-${++this.seq}`, event };
    this.buffer.push(stamped);
    if (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
    for (const listener of this.listeners) {
      listener(stamped);
    }
    return stamped;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  replaySince(lastEventId: string): ReplayResult {
    const [epoch, rawSeq] = lastEventId.split('-');
    const seq = Number(rawSeq);
    if (epoch !== this.epoch || !Number.isInteger(seq) || seq < 0 || seq > this.seq) {
      return { kind: 'resync' };
    }
    if (seq === this.seq) {
      return { kind: 'events', events: [] };
    }
    const oldest = this.buffer[0];
    const oldestSeq = oldest ? Number(oldest.id.split('-')[1]) : this.seq + 1;
    if (seq < oldestSeq - 1) {
      return { kind: 'resync' };
    }
    return {
      kind: 'events',
      events: this.buffer.filter((e) => Number(e.id.split('-')[1]) > seq),
    };
  }
}
