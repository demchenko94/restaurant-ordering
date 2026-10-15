import {
  canTransition,
  type CheckoutRequest,
  type Order,
  type OrdersPage,
  type OrderStatus,
} from '@restaurant/contracts';
import { Types } from 'mongoose';
import { AppError } from '../../common/errors';
import { hashPayload } from '../../common/hash';
import { isDuplicateKey } from '../../common/mongo';
import type { CounterRepository } from '../../database/counter.repository';
import type { CheckoutService } from '../checkout/checkout.service';
import type { EventBus } from '../events/event-bus';
import { toOrder, type OrderDoc } from './order.entity';
import type { OrderRepository } from './order.repository';

export interface PlaceOrderResult {
  order: Order;
  /** True when the idempotency key had already produced this order. */
  replayed: boolean;
}

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly counters: CounterRepository,
    private readonly checkout: CheckoutService,
    private readonly bus: EventBus,
  ) {}

  /**
   * Places an order exactly once per idempotency key:
   *  - same key + same payload  -> the original order (replay)
   *  - same key + other payload -> 422
   *  - concurrent duplicates    -> the unique index lets one insert win; the loser replays it
   */
  async place(idempotencyKey: string, request: CheckoutRequest): Promise<PlaceOrderResult> {
    const requestHash = hashPayload(request);

    const existing = await this.orders.findByIdempotencyKey(idempotencyKey);
    if (existing) return this.replay(existing, requestHash);

    const quote = await this.checkout.quote(request);
    if (!quote.ok) {
      throw new AppError(
        409,
        'CART_CHANGED',
        'Some items changed while you were ordering',
        quote.changes,
      );
    }

    const number = await this.counters.next('orderNumber');
    try {
      const doc = await this.orders.create({
        number,
        status: 'placed',
        lines: quote.lines.map((l) => ({
          itemId: new Types.ObjectId(l.itemId),
          name: l.name,
          categoryName: l.categoryName,
          unitPriceCents: l.unitPriceCents,
          quantity: l.quantity,
          openPrice: l.openPrice,
        })),
        subtotalCents: quote.subtotalCents,
        discountCents: quote.discountCents,
        totalCents: quote.totalCents,
        idempotencyKey,
        requestHash,
        statusHistory: [{ status: 'placed', at: new Date() }],
      });
      const order = toOrder(doc);
      this.bus.publish({ type: 'order.created', order });
      return { order, replayed: false };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      const winner = await this.orders.findByIdempotencyKey(idempotencyKey);
      if (!winner) throw error;
      return this.replay(winner, requestHash);
    }
  }

  async get(id: string): Promise<Order> {
    const doc = await this.orders.findById(id);
    if (!doc) throw AppError.notFound('Order');
    return toOrder(doc);
  }

  async list(limit: number, cursor?: string): Promise<OrdersPage> {
    const { docs, nextCursor } = await this.orders.findPage(limit, cursor);
    return { items: docs.map(toOrder), nextCursor };
  }

  /** Moves an order to `to` if the state machine allows it; atomic against concurrent changes. */
  async transition(id: string, to: OrderStatus): Promise<Order> {
    const current = await this.orders.findById(id);
    if (!current) throw AppError.notFound('Order');
    if (!canTransition(current.status, to)) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Cannot move an order from ${current.status} to ${to}`,
        { from: current.status, to },
      );
    }
    const updated = await this.orders.transitionStatus(id, current.status, to);
    if (!updated) {
      // Lost a race with another transition: re-evaluate against the fresh state.
      return this.transition(id, to);
    }
    const order = toOrder(updated);
    this.bus.publish({ type: 'order.updated', order });
    return order;
  }

  /** Orders that still need automatic status progression (used by the simulator on boot). */
  async listActive(): Promise<Order[]> {
    return (await this.orders.findActive()).map(toOrder);
  }

  private replay(existing: OrderDoc, requestHash: string): PlaceOrderResult {
    if (existing.requestHash !== requestHash) {
      throw new AppError(
        422,
        'IDEMPOTENCY_KEY_REUSED',
        'This Idempotency-Key was already used with a different request',
      );
    }
    return { order: toOrder(existing), replayed: true };
  }
}
