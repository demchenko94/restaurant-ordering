import type { Order, ServerEvent } from '@restaurant/contracts';
import { EventBus } from '../realtime/event-bus';
import type { OrdersService } from '../services/orders.service';
import { OrderSimulator } from './order-simulator';

const order = (status: Order['status']): Order => ({
  id: 'a'.repeat(24),
  number: 1,
  status,
  lines: [],
  subtotalCents: 0,
  discountCents: 0,
  totalCents: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

describe('OrderSimulator', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function setup(stepMs: number) {
    const bus = new EventBus();
    const transition = jest.fn(async (_id: string, to: Order['status']) => {
      const updated = order(to);
      bus.publish({ type: 'order.updated', order: updated } satisfies ServerEvent);
      return updated;
    });
    const simulator = new OrderSimulator({ transition } as unknown as OrdersService, stepMs, {
      warn: jest.fn(),
    });
    simulator.attach(bus);
    return { bus, transition, simulator };
  }

  it('walks a new order through every status', async () => {
    const { bus, transition } = setup(1000);
    bus.publish({ type: 'order.created', order: order('placed') });

    for (const expected of ['preparing', 'ready', 'completed']) {
      await jest.advanceTimersByTimeAsync(1000);
      expect(transition).toHaveBeenLastCalledWith('a'.repeat(24), expected);
    }
    await jest.advanceTimersByTimeAsync(5000);
    expect(transition).toHaveBeenCalledTimes(3);
  });

  it('does nothing when disabled', async () => {
    const { bus, transition } = setup(0);
    bus.publish({ type: 'order.created', order: order('placed') });
    await jest.advanceTimersByTimeAsync(60_000);
    expect(transition).not.toHaveBeenCalled();
  });

  it('stops scheduling after stop()', async () => {
    const { bus, transition, simulator } = setup(1000);
    bus.publish({ type: 'order.created', order: order('placed') });
    simulator.stop();
    await jest.advanceTimersByTimeAsync(5000);
    expect(transition).not.toHaveBeenCalled();
  });

  it('ignores a cancelled order', async () => {
    const { bus, transition } = setup(1000);
    bus.publish({ type: 'order.updated', order: order('cancelled') });
    await jest.advanceTimersByTimeAsync(5000);
    expect(transition).not.toHaveBeenCalled();
  });
});
