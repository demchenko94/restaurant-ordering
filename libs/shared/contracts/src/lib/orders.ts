import { z } from 'zod';
import { Cents, Id, IsoDate, PriceCents } from './common';

export const OrderStatus = z.enum(['placed', 'preparing', 'ready', 'completed', 'cancelled']);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const OrderLine = z.object({
  itemId: Id,
  name: z.string(),
  categoryName: z.string(),
  unitPriceCents: PriceCents,
  quantity: z.number().int().min(1),
  openPrice: z.boolean(),
});
export type OrderLine = z.infer<typeof OrderLine>;

export const Order = z.object({
  id: Id,
  number: z.number().int(),
  status: OrderStatus,
  lines: z.array(OrderLine),
  subtotalCents: Cents,
  discountCents: Cents,
  totalCents: Cents,
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Order = z.infer<typeof Order>;

export const OrderStatusPatch = z.object({ status: OrderStatus });
export type OrderStatusPatch = z.infer<typeof OrderStatusPatch>;

export const OrdersQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().min(1).max(200).optional(),
});
export type OrdersQuery = z.infer<typeof OrdersQuery>;

export const OrdersPage = z.object({
  items: z.array(Order),
  nextCursor: z.string().nullable(),
});
export type OrdersPage = z.infer<typeof OrdersPage>;

/** Allowed status moves; the single source for server validation and UI buttons. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  placed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}
