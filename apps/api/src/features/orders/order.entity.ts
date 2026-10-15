import { ORDER_STATUS_TRANSITIONS, type Order, type OrderStatus } from '@restaurant/contracts';
import { model, Schema, type Types } from 'mongoose';

export interface OrderLineDoc {
  itemId: Types.ObjectId;
  name: string;
  categoryName: string;
  unitPriceCents: number;
  quantity: number;
  openPrice: boolean;
}

export interface OrderDoc {
  _id: Types.ObjectId;
  number: number;
  status: OrderStatus;
  lines: OrderLineDoc[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  idempotencyKey: string;
  requestHash: string;
  statusHistory: { status: OrderStatus; at: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

const statuses = Object.keys(ORDER_STATUS_TRANSITIONS);

const orderLineSchema = new Schema<OrderLineDoc>(
  {
    itemId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    categoryName: { type: String, required: true },
    unitPriceCents: { type: Number, required: true },
    quantity: { type: Number, required: true },
    openPrice: { type: Boolean, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderDoc>(
  {
    number: { type: Number, required: true, unique: true },
    status: { type: String, enum: statuses, required: true, default: 'placed' },
    lines: { type: [orderLineSchema], required: true },
    subtotalCents: { type: Number, required: true },
    discountCents: { type: Number, required: true },
    totalCents: { type: Number, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    requestHash: { type: String, required: true },
    statusHistory: {
      type: [
        new Schema(
          { status: { type: String, enum: statuses, required: true }, at: Date },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

orderSchema.index({ createdAt: -1, _id: -1 });
orderSchema.index({ status: 1 });

export const OrderModel = model<OrderDoc>('Order', orderSchema, 'orders');

export function toOrder(doc: OrderDoc): Order {
  return {
    id: doc._id.toHexString(),
    number: doc.number,
    status: doc.status,
    lines: doc.lines.map((l) => ({
      itemId: l.itemId.toHexString(),
      name: l.name,
      categoryName: l.categoryName,
      unitPriceCents: l.unitPriceCents,
      quantity: l.quantity,
      openPrice: l.openPrice,
    })),
    subtotalCents: doc.subtotalCents,
    discountCents: doc.discountCents,
    totalCents: doc.totalCents,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
