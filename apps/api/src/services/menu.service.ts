import type {
  CategoryInput,
  CategoryPatch,
  MenuItem,
  MenuItemInput,
  MenuItemPatch,
  MenuSnapshot,
  ServerEvent,
} from '@restaurant/contracts';
import type { Category } from '@restaurant/contracts';
import { Types } from 'mongoose';
import { AppError } from '../http/errors';
import { toCategory, toMenuItem } from '../persistence/mappers';
import { CategoryModel } from '../persistence/models/category.model';
import { nextCounter, readCounter } from '../persistence/models/counter.model';
import { MenuItemModel, type MenuItemDoc } from '../persistence/models/menu-item.model';
import type { EventBus } from '../realtime/event-bus';
import { SerialQueue } from './serial-queue';

const MONGO_DUPLICATE_KEY = 11000;

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === MONGO_DUPLICATE_KEY;
}

/**
 * Menu use cases. Every mutation is: write -> bump `menuRevision` -> publish an event.
 * Mutations run through a serial queue so revisions are published in order.
 */
export class MenuService {
  private readonly queue = new SerialQueue();

  constructor(private readonly bus: EventBus) {}

  async getSnapshot(): Promise<MenuSnapshot> {
    const [revision, categories, items] = await Promise.all([
      readCounter('menuRevision'),
      CategoryModel.find().sort({ sortOrder: 1, name: 1 }).lean(),
      MenuItemModel.find().sort({ categoryId: 1, sortOrder: 1, name: 1 }).lean(),
    ]);
    return {
      revision,
      categories: categories.map(toCategory),
      items: items.map(toMenuItem),
    };
  }

  getRevision(): Promise<number> {
    return readCounter('menuRevision');
  }

  // ---- categories ---------------------------------------------------------

  createCategory(input: CategoryInput): Promise<Category> {
    return this.queue.run(async () => {
      const last = await CategoryModel.findOne().sort({ sortOrder: -1 }).lean();
      try {
        const doc = await CategoryModel.create({
          name: input.name,
          nameKey: input.name.toLowerCase(),
          sortOrder: (last?.sortOrder ?? -1) + 1,
        });
        const category = toCategory(doc.toObject());
        await this.publish((revision) => ({ type: 'menu.category.upserted', revision, category }));
        return category;
      } catch (error) {
        throw this.mapDuplicateName(error);
      }
    });
  }

  updateCategory(id: string, patch: CategoryPatch): Promise<Category> {
    return this.queue.run(async () => {
      const update: Record<string, unknown> = {};
      if (patch.name !== undefined) {
        update['name'] = patch.name;
        update['nameKey'] = patch.name.toLowerCase();
      }
      if (patch.sortOrder !== undefined) {
        update['sortOrder'] = patch.sortOrder;
      }
      try {
        const doc = await CategoryModel.findByIdAndUpdate(id, update, {
          returnDocument: 'after',
          runValidators: true,
        }).lean();
        if (!doc) throw AppError.notFound('Category');
        const category = toCategory(doc);
        await this.publish((revision) => ({ type: 'menu.category.upserted', revision, category }));
        return category;
      } catch (error) {
        throw this.mapDuplicateName(error);
      }
    });
  }

  deleteCategory(id: string): Promise<void> {
    return this.queue.run(async () => {
      const category = await CategoryModel.findById(id).lean();
      if (!category) throw AppError.notFound('Category');
      const itemCount = await MenuItemModel.countDocuments({ categoryId: category._id });
      if (itemCount > 0) {
        throw new AppError(
          409,
          'CATEGORY_NOT_EMPTY',
          'Move or delete the items in this category first',
          { itemCount },
        );
      }
      await CategoryModel.deleteOne({ _id: category._id });
      await this.publish((revision) => ({ type: 'menu.category.deleted', revision, id }));
    });
  }

  // ---- items --------------------------------------------------------------

  createItem(input: MenuItemInput): Promise<MenuItem> {
    return this.queue.run(async () => {
      await this.assertCategoryExists(input.categoryId);
      const last = await MenuItemModel.findOne({ categoryId: input.categoryId })
        .sort({ sortOrder: -1 })
        .lean();
      const doc = await MenuItemModel.create({
        categoryId: new Types.ObjectId(input.categoryId),
        name: input.name,
        description: input.description,
        available: input.available ?? true,
        openPrice: input.openPrice,
        priceCents: input.openPrice ? null : input.priceCents,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      });
      const item = toMenuItem(doc.toObject());
      await this.publish((revision) => ({ type: 'menu.item.upserted', revision, item }));
      return item;
    });
  }

  updateItem(id: string, patch: MenuItemPatch): Promise<MenuItem> {
    return this.queue.run(async () => {
      const doc = await MenuItemModel.findById(id);
      if (!doc) throw AppError.notFound('Menu item');

      if (patch.categoryId !== undefined) {
        await this.assertCategoryExists(patch.categoryId);
        doc.categoryId = new Types.ObjectId(patch.categoryId);
      }
      if (patch.name !== undefined) doc.name = patch.name;
      if (patch.description !== undefined) {
        doc.description = patch.description ?? undefined;
      }
      if (patch.available !== undefined) doc.available = patch.available;
      if (patch.sortOrder !== undefined) doc.sortOrder = patch.sortOrder;

      const openPrice = patch.openPrice ?? doc.openPrice;
      // Switching to open price clears the price; a fixed price must be supplied explicitly
      // when switching away from it.
      const priceCents = openPrice ? null : (patch.priceCents ?? doc.priceCents);
      if (!openPrice && (priceCents === null || priceCents === undefined)) {
        throw AppError.validation('A fixed-price item requires priceCents', [
          { path: ['priceCents'], message: 'Required when openPrice is false' },
        ]);
      }
      doc.openPrice = openPrice;
      doc.priceCents = priceCents;

      await doc.save();
      const item = toMenuItem(doc.toObject() as MenuItemDoc);
      await this.publish((revision) => ({ type: 'menu.item.upserted', revision, item }));
      return item;
    });
  }

  deleteItem(id: string): Promise<void> {
    return this.queue.run(async () => {
      const result = await MenuItemModel.deleteOne({ _id: id });
      if (result.deletedCount === 0) throw AppError.notFound('Menu item');
      await this.publish((revision) => ({ type: 'menu.item.deleted', revision, id }));
    });
  }

  // ---- helpers ------------------------------------------------------------

  private async publish(build: (revision: number) => ServerEvent): Promise<void> {
    const revision = await nextCounter('menuRevision');
    this.bus.publish(build(revision));
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const exists = await CategoryModel.exists({ _id: categoryId });
    if (!exists) {
      throw AppError.validation('Category does not exist', [
        { path: ['categoryId'], message: 'Unknown category' },
      ]);
    }
  }

  private mapDuplicateName(error: unknown): unknown {
    return isDuplicateKey(error)
      ? new AppError(409, 'DUPLICATE_NAME', 'A category with this name already exists')
      : error;
  }
}
