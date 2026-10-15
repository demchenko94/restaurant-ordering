import type { OrderStatus } from '@restaurant/contracts';
import { Types } from 'mongoose';
import { AppError } from '../../common/errors';
import { OrderModel, type OrderDoc } from './order.entity';

export type NewOrder = Omit<OrderDoc, '_id' | 'createdAt' | 'updatedAt'>;

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

export class OrderRepository {
  findById(id: string): Promise<OrderDoc | null> {
    return OrderModel.findById(id).lean();
  }

  findByIdempotencyKey(idempotencyKey: string): Promise<OrderDoc | null> {
    return OrderModel.findOne({ idempotencyKey }).lean();
  }

  /** Rejects with a duplicate-key error (E11000) when the idempotency key is already taken. */
  async create(data: NewOrder): Promise<OrderDoc> {
    const doc = await OrderModel.create(data);
    return doc.toObject();
  }

  /** Newest first, keyset-paginated by `(createdAt, _id)`. */
  async findPage(
    limit: number,
    cursor?: string,
  ): Promise<{ docs: OrderDoc[]; nextCursor: string | null }> {
    const filter: Record<string, unknown> = {};
    if (cursor) {
      const { createdAt, id } = decodeCursor(cursor);
      filter['$or'] = [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: id } }];
    }
    const found = await OrderModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const docs = found.slice(0, limit);
    const last = docs[docs.length - 1];
    return { docs, nextCursor: found.length > limit && last ? encodeCursor(last) : null };
  }

  /** Atomic compare-and-set on the status; `null` when the order was not in `from`. */
  transitionStatus(id: string, from: OrderStatus, to: OrderStatus): Promise<OrderDoc | null> {
    return OrderModel.findOneAndUpdate(
      { _id: id, status: from },
      { $set: { status: to }, $push: { statusHistory: { status: to, at: new Date() } } },
      { returnDocument: 'after' },
    ).lean();
  }

  /** Orders that still need automatic status progression. */
  findActive(): Promise<OrderDoc[]> {
    return OrderModel.find({ status: { $in: ['placed', 'preparing', 'ready'] } })
      .sort({ createdAt: 1 })
      .lean();
  }
}
