/**
 * Names of every server event. Kept in a file without runtime dependencies so the web app can
 * recognize events at startup without loading Zod; `events.spec.ts` checks it matches the schema.
 */
export const SERVER_EVENT_TYPES = [
  'menu.category.upserted',
  'menu.category.deleted',
  'menu.item.upserted',
  'menu.item.deleted',
  'order.created',
  'order.updated',
  'resync',
] as const;
