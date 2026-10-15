import type { ServerEvent } from '@restaurant/contracts';
import { SerialQueue } from '../../common/serial-queue';
import type { CounterRepository } from '../../database/counter.repository';
import type { EventBus } from '../events/event-bus';

/**
 * The single place where a menu change becomes visible to clients: write → bump `menuRevision`
 * → publish an event. Writes run through a serial queue so revisions are published in order.
 * Categories and items both go through it, so they share one revision sequence.
 */
export class MenuChanges {
  private readonly queue = new SerialQueue();

  constructor(
    private readonly counters: CounterRepository,
    private readonly bus: EventBus,
  ) {}

  commit<T>(
    write: () => Promise<T>,
    toEvent: (result: T, revision: number) => ServerEvent,
  ): Promise<T> {
    return this.queue.run(async () => {
      const result = await write();
      const revision = await this.counters.next('menuRevision');
      this.bus.publish(toEvent(result, revision));
      return result;
    });
  }

  revision(): Promise<number> {
    return this.counters.current('menuRevision');
  }
}
