import type { MenuSnapshot } from '@restaurant/contracts';
import type { CategoryRepository } from '../categories/category.repository';
import { toCategory } from '../categories/category.entity';
import type { ItemRepository } from '../items/item.repository';
import { toMenuItem } from '../items/item.entity';
import type { MenuChanges } from './menu-changes';

/** Read side of the menu: the full snapshot the ordering screen works from. */
export class MenuService {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly items: ItemRepository,
    private readonly changes: MenuChanges,
  ) {}

  getRevision(): Promise<number> {
    return this.changes.revision();
  }

  async getSnapshot(): Promise<MenuSnapshot> {
    const [revision, categories, items] = await Promise.all([
      this.changes.revision(),
      this.categories.findAll(),
      this.items.findAll(),
    ]);
    return { revision, categories: categories.map(toCategory), items: items.map(toMenuItem) };
  }
}
