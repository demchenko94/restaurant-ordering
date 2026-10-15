import { MenuItemInput, MenuItemPatch, CategoryInput } from './menu';

const categoryId = 'a'.repeat(24);

describe('MenuItemInput', () => {
  it('requires a price for fixed-price items', () => {
    const result = MenuItemInput.safeParse({ categoryId, name: 'Soup', openPrice: false });
    expect(result.success).toBe(false);
  });

  it('accepts a fixed-price item and defaults availability to true', () => {
    const result = MenuItemInput.parse({
      categoryId,
      name: 'Soup',
      openPrice: false,
      priceCents: 650,
    });
    expect(result.available).toBe(true);
  });

  it('accepts an open-price item without a price', () => {
    expect(MenuItemInput.safeParse({ categoryId, name: 'Special', openPrice: true }).success).toBe(
      true,
    );
  });

  it('rejects zero, fractional and oversized prices', () => {
    for (const priceCents of [0, 1.5, 1_000_001]) {
      const result = MenuItemInput.safeParse({
        categoryId,
        name: 'Soup',
        openPrice: false,
        priceCents,
      });
      expect(result.success).toBe(false);
    }
  });

  it('trims names and rejects blank ones', () => {
    expect(CategoryInput.parse({ name: '  Pizza ' }).name).toBe('Pizza');
    expect(CategoryInput.safeParse({ name: '   ' }).success).toBe(false);
  });
});

describe('MenuItemPatch', () => {
  it('rejects an empty patch', () => {
    expect(MenuItemPatch.safeParse({}).success).toBe(false);
  });

  it('accepts a partial patch', () => {
    expect(MenuItemPatch.safeParse({ available: false }).success).toBe(true);
  });
});
