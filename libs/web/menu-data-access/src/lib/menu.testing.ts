import type { Category, MenuItem, MenuSnapshot } from '@restaurant/contracts';

export const id = (n: number): string => n.toString(16).padStart(24, '0');

export const category = (n: number, name = `Category ${n}`): Category => ({
  id: id(n),
  name,
  sortOrder: n,
});

export const fixedItem = (
  n: number,
  categoryId: string,
  priceCents = 1000,
  available = true,
): MenuItem => ({
  id: id(n),
  categoryId,
  name: `Item ${n}`,
  available,
  sortOrder: n,
  openPrice: false,
  priceCents,
});

export const openItem = (n: number, categoryId: string): MenuItem => ({
  id: id(n),
  categoryId,
  name: `Open ${n}`,
  available: true,
  sortOrder: n,
  openPrice: true,
  priceCents: null,
});

export const snapshot = (revision = 1): MenuSnapshot => ({
  revision,
  categories: [category(1, 'Pizza'), category(2, 'Pasta')],
  items: [
    fixedItem(10, id(1), 950),
    fixedItem(11, id(1), 1100),
    openItem(12, id(1)),
    fixedItem(20, id(2), 800),
  ],
});
