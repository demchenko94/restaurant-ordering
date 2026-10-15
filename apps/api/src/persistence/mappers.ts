import type { Category, MenuItem, Order } from '@restaurant/contracts';
import type { CategoryDoc } from './models/category.model';
import type { MenuItemDoc } from './models/menu-item.model';
import type { OrderDoc } from './models/order.model';

export function toCategory(doc: CategoryDoc): Category {
  return { id: doc._id.toHexString(), name: doc.name, sortOrder: doc.sortOrder };
}

export function toMenuItem(doc: MenuItemDoc): MenuItem {
  const base = {
    id: doc._id.toHexString(),
    categoryId: doc.categoryId.toHexString(),
    name: doc.name,
    available: doc.available,
    sortOrder: doc.sortOrder,
    ...(doc.description ? { description: doc.description } : {}),
  };
  return doc.openPrice
    ? { ...base, openPrice: true, priceCents: null }
    : { ...base, openPrice: false, priceCents: doc.priceCents as number };
}

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
