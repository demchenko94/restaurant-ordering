import type { Request, Response } from 'express';
import type { EventBus, StampedEvent } from './event-bus';

const HEARTBEAT_MS = 20_000;
const RETRY_MS = 3_000;

function frame({ id, event }: StampedEvent): string {
  return `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * `GET /api/events`. Replays missed events when the client reconnects with `Last-Event-ID`,
 * or tells it to reload (`resync`) when that is impossible.
 */
export function sseHandler(bus: EventBus, heartbeatMs = HEARTBEAT_MS) {
  return (req: Request, res: Response): void => {
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(`retry: ${RETRY_MS}\n\n`);

    // Subscribe before replaying so nothing published in between is lost; ids are
    // monotonic, so anything already replayed is skipped below.
    let lastSent = -1;
    const seqOf = (id: string) => Number(id.split('-')[1]);
    const send = (stamped: StampedEvent) => {
      const seq = seqOf(stamped.id);
      if (seq <= lastSent) return;
      lastSent = seq;
      res.write(frame(stamped));
    };
    const unsubscribe = bus.subscribe(send);

    const lastEventId = req.header('last-event-id');
    if (lastEventId) {
      const replay = bus.replaySince(lastEventId);
      if (replay.kind === 'resync') {
        res.write(`event: resync\ndata: ${JSON.stringify({ type: 'resync' })}\n\n`);
      } else {
        replay.events.forEach(send);
      }
    }

    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), heartbeatMs);
    heartbeat.unref();

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  };
}
