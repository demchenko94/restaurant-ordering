import { Types } from 'mongoose';
import { CategoryModel } from '../persistence/models/category.model';
import { CounterModel } from '../persistence/models/counter.model';
import { MenuItemModel } from '../persistence/models/menu-item.model';

const CATEGORIES: Record<string, string[]> = {
  Pizza: ['Margherita', 'Pepperoni', 'Quattro Formaggi', 'Diavola', 'Capricciosa', 'Funghi'],
  Pasta: ['Carbonara', 'Bolognese', 'Arrabbiata', 'Alfredo', 'Pesto', 'Lasagna'],
  Burgers: ['Classic', 'Cheese', 'Bacon', 'Veggie', 'BBQ', 'Mushroom Swiss'],
  Salads: ['Caesar', 'Greek', 'Caprese', 'Cobb', 'Nicoise', 'Waldorf'],
  Soups: ['Tomato', 'Minestrone', 'Onion', 'Mushroom', 'Chicken Noodle', 'Pumpkin'],
  Seafood: ['Grilled Salmon', 'Fish and Chips', 'Calamari', 'Shrimp Scampi', 'Tuna Steak'],
  Grill: ['Ribeye', 'Sirloin', 'Lamb Chops', 'Pork Ribs', 'Chicken Skewers', 'Sausage Plate'],
  Sides: ['Fries', 'Onion Rings', 'Garlic Bread', 'Rice', 'Coleslaw', 'Roasted Vegetables'],
  Desserts: ['Tiramisu', 'Cheesecake', 'Panna Cotta', 'Brownie', 'Gelato', 'Apple Pie'],
  Drinks: ['Cola', 'Lemonade', 'Iced Tea', 'Espresso', 'Latte', 'Sparkling Water'],
  Wine: ['Chianti', 'Pinot Grigio', 'Merlot', 'Prosecco', 'Rose', 'Chardonnay'],
  Beer: ['Lager', 'IPA', 'Stout', 'Wheat Beer', 'Pilsner', 'Amber Ale'],
};
const VARIANTS = [
  '',
  'Large',
  'Small',
  'Spicy',
  'House',
  'Seasonal',
  'Deluxe',
  'Light',
  'XL',
  'Family',
];

/** Small deterministic PRNG so every seeded database is the same. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Creates categories and about `itemCount` items for the large-menu scenario.
 * Returns the number of items created, or 0 when skipped.
 */
export async function seedMenu(
  itemCount: number,
  { onlyIfEmpty }: { onlyIfEmpty: boolean },
): Promise<number> {
  if (onlyIfEmpty && (await CategoryModel.estimatedDocumentCount()) > 0) return 0;

  await Promise.all([
    CategoryModel.deleteMany({}),
    MenuItemModel.deleteMany({}),
    CounterModel.deleteOne({ _id: 'menuRevision' }),
  ]);

  const random = mulberry32(42);
  const categoryNames = Object.keys(CATEGORIES);
  const categories = await CategoryModel.insertMany(
    categoryNames.map((name, sortOrder) => ({ name, nameKey: name.toLowerCase(), sortOrder })),
  );

  const perCategory = Math.ceil(itemCount / categories.length);
  const items = [];
  for (const category of categories) {
    const dishes = CATEGORIES[category.name] ?? [];
    for (let i = 0; i < perCategory && items.length < itemCount; i++) {
      const dish = dishes[i % dishes.length];
      const variant = VARIANTS[Math.floor(i / dishes.length) % VARIANTS.length];
      const round = Math.floor(i / (dishes.length * VARIANTS.length));
      const name = [variant, dish, round > 0 ? `#${round + 1}` : ''].filter(Boolean).join(' ');
      const openPrice = random() < 0.03;
      items.push({
        _id: new Types.ObjectId(),
        categoryId: category._id,
        name,
        description: `${dish} prepared fresh in our kitchen`,
        openPrice,
        priceCents: openPrice ? null : 300 + Math.floor(random() * 3200),
        available: random() > 0.05,
        sortOrder: i,
      });
    }
  }
  for (let i = 0; i < items.length; i += 1000) {
    await MenuItemModel.insertMany(items.slice(i, i + 1000), { ordered: false });
  }
  await CounterModel.updateOne({ _id: 'menuRevision' }, { $set: { seq: 1 } }, { upsert: true });
  return items.length;
}
