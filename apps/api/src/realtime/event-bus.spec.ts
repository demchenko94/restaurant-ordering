import type { ServerEvent } from '@restaurant/contracts';
import { EventBus } from './event-bus';

const ev = (revision: number): ServerEvent => ({
  type: 'menu.item.deleted',
  revision,
  id: 'a'.repeat(24),
});

describe('EventBus', () => {
  it('delivers events to subscribers until they unsubscribe', () => {
    const bus = new EventBus();
    const seen: number[] = [];
    const off = bus.subscribe((s) => seen.push((s.event as { revision: number }).revision));
    bus.publish(ev(1));
    off();
    bus.publish(ev(2));
    expect(seen).toEqual([1]);
    expect(bus.listenerCount).toBe(0);
  });

  it('replays events after a known id', () => {
    const bus = new EventBus();
    const first = bus.publish(ev(1));
    bus.publish(ev(2));
    bus.publish(ev(3));
    const result = bus.replaySince(first.id);
    expect(result.kind).toBe('events');
    if (result.kind === 'events') {
      expect(result.events.map((e) => (e.event as { revision: number }).revision)).toEqual([2, 3]);
    }
  });

  it('replays nothing when the client is up to date', () => {
    const bus = new EventBus();
    const last = bus.publish(ev(1));
    expect(bus.replaySince(last.id)).toEqual({ kind: 'events', events: [] });
  });

  it('asks for a resync when the id fell out of the buffer', () => {
    const bus = new EventBus(10);
    const first = bus.publish(ev(1));
    for (let i = 2; i <= 30; i++) bus.publish(ev(i));
    expect(bus.replaySince(first.id)).toEqual({ kind: 'resync' });
  });

  it('asks for a resync for ids from another server run or garbage', () => {
    const bus = new EventBus();
    bus.publish(ev(1));
    expect(bus.replaySince('other-5')).toEqual({ kind: 'resync' });
    expect(bus.replaySince('nonsense')).toEqual({ kind: 'resync' });
  });
});
