import type { Order, OrderStatus } from '@restaurant/contracts';
import type { EventBus } from '../realtime/event-bus';
import type { OrdersService } from '../services/orders.service';

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};

export interface SimulatorLogger {
  warn(obj: unknown, msg?: string): void;
}

/**
 * Stands in for a kitchen: advances every order placed -> preparing -> ready -> completed
 * on a timer. It uses the same `OrdersService.transition` as the manual PATCH endpoint,
 * so both paths emit identical events.
 */
export class OrderSimulator {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private stopped = false;

  constructor(
    private readonly orders: OrdersService,
    private readonly stepMs: number,
    private readonly logger: SimulatorLogger,
  ) {}

  get enabled(): boolean {
    return this.stepMs > 0;
  }

  schedule(order: Pick<Order, 'id' | 'status'>): void {
    const next = NEXT[order.status];
    if (!this.enabled || this.stopped || !next) return;

    clearTimeout(this.timers.get(order.id));
    const timer = setTimeout(() => {
      this.timers.delete(order.id);
      // The resulting `order.updated` event re-schedules the following step (see `attach`).
      this.orders
        .transition(order.id, next)
        // An order cancelled or changed manually meanwhile is not an error.
        .catch((error: { code?: string }) => {
          if (error?.code !== 'INVALID_STATUS_TRANSITION' && error?.code !== 'NOT_FOUND') {
            this.logger.warn({ err: error, orderId: order.id }, 'simulator step failed');
          }
        });
    }, this.stepMs);
    timer.unref();
    this.timers.set(order.id, timer);
  }

  /** Follows the event stream: every new or changed order gets its next step scheduled. */
  attach(bus: EventBus): () => void {
    return bus.subscribe(({ event }) => {
      if (event.type === 'order.created' || event.type === 'order.updated') {
        this.schedule(event.order);
      }
    });
  }

  /** Picks up orders left mid-flight by a previous server run. */
  async resume(): Promise<void> {
    if (!this.enabled) return;
    for (const order of await this.orders.listActive()) {
      this.schedule(order);
    }
  }

  stop(): void {
    this.stopped = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
