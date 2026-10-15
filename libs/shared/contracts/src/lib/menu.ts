import { z } from 'zod';
import { CATEGORY_NAME_MAX, ITEM_DESCRIPTION_MAX, ITEM_NAME_MAX } from './constants';
import { Id, PriceCents } from './common';

export const Category = z.object({
  id: Id,
  name: z.string(),
  sortOrder: z.number().int(),
});
export type Category = z.infer<typeof Category>;

export const CategoryInput = z.object({
  name: z.string().trim().min(1).max(CATEGORY_NAME_MAX),
});
export type CategoryInput = z.infer<typeof CategoryInput>;

export const CategoryPatch = CategoryInput.partial().extend({
  sortOrder: z.number().int().min(0).optional(),
});
export type CategoryPatch = z.infer<typeof CategoryPatch>;

const itemFields = {
  categoryId: Id,
  name: z.string().trim().min(1).max(ITEM_NAME_MAX),
  description: z.string().trim().max(ITEM_DESCRIPTION_MAX).optional(),
  available: z.boolean().default(true),
};

/**
 * Create payload. `openPrice` decides whether `priceCents` exists, so the
 * invariant is part of the type: open-price items carry no price.
 */
export const MenuItemInput = z.discriminatedUnion('openPrice', [
  z.object({ ...itemFields, openPrice: z.literal(false), priceCents: PriceCents }),
  z.object({ ...itemFields, openPrice: z.literal(true) }),
]);
export type MenuItemInput = z.input<typeof MenuItemInput>;

const itemResponseFields = {
  id: Id,
  sortOrder: z.number().int(),
  categoryId: Id,
  name: z.string(),
  description: z.string().optional(),
  available: z.boolean(),
};

export const MenuItem = z.discriminatedUnion('openPrice', [
  z.object({ ...itemResponseFields, openPrice: z.literal(false), priceCents: PriceCents }),
  z.object({ ...itemResponseFields, openPrice: z.literal(true), priceCents: z.null() }),
]);
export type MenuItem = z.infer<typeof MenuItem>;

/**
 * Partial update. Cross-field rules (`openPrice` vs `priceCents`) are checked
 * by the server against the merged document.
 */
export const MenuItemPatch = z
  .object({
    categoryId: Id,
    name: itemFields.name,
    description: z.string().trim().max(ITEM_DESCRIPTION_MAX).nullable(),
    available: z.boolean(),
    openPrice: z.boolean(),
    priceCents: PriceCents.nullable(),
    sortOrder: z.number().int().min(0),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Patch must change at least one field');
export type MenuItemPatch = z.infer<typeof MenuItemPatch>;

export const MenuSnapshot = z.object({
  revision: z.number().int().nonnegative(),
  categories: z.array(Category),
  items: z.array(MenuItem),
});
export type MenuSnapshot = z.infer<typeof MenuSnapshot>;
