import {
  canTransition,
  type CheckoutRequest,
  type Order,
  type OrdersPage,
  type OrderStatus,
} from '@restaurant/contracts';
import { Types } from 'mongoose';
import { hashPayload } from '../domain/hash';
import { AppError } from '../http/errors';
import { toOrder } from '../persistence/mappers';
import { nextCounter } from '../persistence/models/counter.model';
import { OrderModel, type OrderDoc } from '../persistence/models/order.model';
import type { EventBus } from '../realtime/event-bus';
import type { CheckoutService } from './checkout.service';

export interface PlaceOrderResult {
  order: Order;
  /** True when the idempotency key had already produced this order. */
  replayed: boolean;
}

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 11000;
}

function encodeCursor(doc: Pick<OrderDoc, 'createdAt' | '_id'>): string {
  return Buffer.from(`${doc.createdAt.getTime()}_${doc._id.toHexString()}`).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: Types.ObjectId } {
  const [ms, id] = Buffer.from(cursor, 'base64url').toString().split('_');
  const time = Number(ms);
  if (!Number.isFinite(time) || !id || !Types.ObjectId.isValid(id)) {
    throw AppError.validation('Invalid cursor', [
      { path: ['cursor'], message: 'Malformed cursor' },
    ]);
  }
  return { createdAt: new Date(time), id: new Types.ObjectId(id) };
}

export class OrdersService {
  constructor(
    private readonly bus: EventBus,
    private readonly checkout: CheckoutService,
  ) {}

  /**
   * Places an order exactly once per idempotency key:
   *  - same key + same payload  -> the original order (replay)
   *  - same key + other payload -> 422
   *  - concurrent duplicates    -> the unique index lets one insert win; the loser replays it
   */
  async place(idempotencyKey: string, request: CheckoutRequest): Promise<PlaceOrderResult> {
    const requestHash = hashPayload(request);

    const existing = await OrderModel.findOne({ idempotencyKey }).lean();
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

    const number = await nextCounter('orderNumber');
    const now = new Date();
    try {
      const doc = await OrderModel.create({
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
        statusHistory: [{ status: 'placed', at: now }],
      });
      const order = toOrder(doc.toObject());
      this.bus.publish({ type: 'order.created', order });
      return { order, replayed: false };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      const winner = await OrderModel.findOne({ idempotencyKey }).lean();
      if (!winner) throw error;
      return this.replay(winner, requestHash);
    }
  }

  async get(id: string): Promise<Order> {
    const doc = await OrderModel.findById(id).lean();
    if (!doc) throw AppError.notFound('Order');
    return toOrder(doc);
  }

  async list(limit: number, cursor?: string): Promise<OrdersPage> {
    const filter: Record<string, unknown> = {};
    if (cursor) {
      const { createdAt, id } = decodeCursor(cursor);
      filter['$or'] = [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: id } }];
    }
    const docs = await OrderModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const page = docs.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map(toOrder),
      nextCursor: docs.length > limit && last ? encodeCursor(last) : null,
    };
  }

  /** Moves an order to `to` if the state machine allows it; atomic against concurrent changes. */
  async transition(id: string, to: OrderStatus): Promise<Order> {
    const current = await OrderModel.findById(id).lean();
    if (!current) throw AppError.notFound('Order');
    if (!canTransition(current.status, to)) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Cannot move an order from ${current.status} to ${to}`,
        { from: current.status, to },
      );
    }
    const updated = await OrderModel.findOneAndUpdate(
      { _id: id, status: current.status },
      { $set: { status: to }, $push: { statusHistory: { status: to, at: new Date() } } },
      { returnDocument: 'after' },
    ).lean();
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
    const docs = await OrderModel.find({ status: { $in: ['placed', 'preparing', 'ready'] } })
      .sort({ createdAt: 1 })
      .lean();
    return docs.map(toOrder);
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
