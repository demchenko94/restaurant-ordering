import { z } from 'zod';
import { Id } from './common';
import { Category, MenuItem } from './menu';
import { Order } from './orders';

const revision = z.number().int().nonnegative();

export const ServerEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('menu.category.upserted'), revision, category: Category }),
  z.object({ type: z.literal('menu.category.deleted'), revision, id: Id }),
  z.object({ type: z.literal('menu.item.upserted'), revision, item: MenuItem }),
  z.object({ type: z.literal('menu.item.deleted'), revision, id: Id }),
  z.object({ type: z.literal('order.created'), order: Order }),
  z.object({ type: z.literal('order.updated'), order: Order }),
  /** Server could not replay missed events: the client must reload its data. */
  z.object({ type: z.literal('resync') }),
]);
export type ServerEvent = z.infer<typeof ServerEvent>;
export type ServerEventType = ServerEvent['type'];
