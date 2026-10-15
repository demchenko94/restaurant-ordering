import type { MenuItem, MenuItemInput, MenuItemPatch } from '@restaurant/contracts';
import { Types } from 'mongoose';
import { AppError } from '../../common/errors';
import type { CategoryRepository } from '../categories/category.repository';
import type { MenuChanges } from '../menu/menu-changes';
import { toMenuItem } from './item.entity';
import type { ItemRepository, ItemUpdate } from './item.repository';

export class ItemService {
  constructor(
    private readonly items: ItemRepository,
    private readonly categories: CategoryRepository,
    private readonly changes: MenuChanges,
  ) {}

  create(input: MenuItemInput): Promise<MenuItem> {
    return this.changes.commit(
      async () => {
        await this.assertCategoryExists(input.categoryId);
        const doc = await this.items.create({
          categoryId: new Types.ObjectId(input.categoryId),
          name: input.name,
          description: input.description,
          available: input.available ?? true,
          openPrice: input.openPrice,
          priceCents: input.openPrice ? null : input.priceCents,
          sortOrder: (await this.items.lastSortOrderIn(input.categoryId)) + 1,
        });
        return toMenuItem(doc);
      },
      (item, revision) => ({ type: 'menu.item.upserted', revision, item }),
    );
  }

  update(id: string, patch: MenuItemPatch): Promise<MenuItem> {
    return this.changes.commit(
      async () => {
        const current = await this.items.findById(id);
        if (!current) throw AppError.notFound('Menu item');

        const update: ItemUpdate = { set: {} };
        if (patch.categoryId !== undefined) {
          await this.assertCategoryExists(patch.categoryId);
          update.set.categoryId = new Types.ObjectId(patch.categoryId);
        }
        if (patch.name !== undefined) update.set.name = patch.name;
        if (patch.description !== undefined) {
          if (patch.description === null) update.unset = ['description'];
          else update.set.description = patch.description;
        }
        if (patch.available !== undefined) update.set.available = patch.available;
        if (patch.sortOrder !== undefined) update.set.sortOrder = patch.sortOrder;

        const openPrice = patch.openPrice ?? current.openPrice;
        // Switching to open price clears the price; a fixed price must be supplied explicitly
        // when switching away from it.
        const priceCents = openPrice ? null : (patch.priceCents ?? current.priceCents);
        if (!openPrice && (priceCents === null || priceCents === undefined)) {
          throw AppError.validation('A fixed-price item requires priceCents', [
            { path: ['priceCents'], message: 'Required when openPrice is false' },
          ]);
        }
        update.set.openPrice = openPrice;
        update.set.priceCents = priceCents;

        const updated = await this.items.updateById(id, update);
        if (!updated) throw AppError.notFound('Menu item');
        return toMenuItem(updated);
      },
      (item, revision) => ({ type: 'menu.item.upserted', revision, item }),
    );
  }

  delete(id: string): Promise<void> {
    return this.changes.commit(
      async () => {
        if (!(await this.items.deleteById(id))) throw AppError.notFound('Menu item');
      },
      (_result, revision) => ({ type: 'menu.item.deleted', revision, id }),
    );
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    if (!(await this.categories.exists(categoryId))) {
      throw AppError.validation('Category does not exist', [
        { path: ['categoryId'], message: 'Unknown category' },
      ]);
    }
  }
}
