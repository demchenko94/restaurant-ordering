import type { Category, CategoryInput, CategoryPatch } from '@restaurant/contracts';
import { AppError } from '../../common/errors';
import { isDuplicateKey } from '../../common/mongo';
import type { ItemRepository } from '../items/item.repository';
import type { MenuChanges } from '../menu/menu-changes';
import { toCategory } from './category.entity';
import type { CategoryRepository } from './category.repository';

export class CategoryService {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly items: ItemRepository,
    private readonly changes: MenuChanges,
  ) {}

  create(input: CategoryInput): Promise<Category> {
    return this.changes.commit(
      async () => {
        try {
          const doc = await this.categories.create({
            name: input.name,
            nameKey: input.name.toLowerCase(),
            sortOrder: (await this.categories.lastSortOrder()) + 1,
          });
          return toCategory(doc);
        } catch (error) {
          throw this.mapDuplicateName(error);
        }
      },
      (category, revision) => ({ type: 'menu.category.upserted', revision, category }),
    );
  }

  update(id: string, patch: CategoryPatch): Promise<Category> {
    return this.changes.commit(
      async () => {
        const set: Parameters<CategoryRepository['updateById']>[1] = {};
        if (patch.name !== undefined) {
          set.name = patch.name;
          set.nameKey = patch.name.toLowerCase();
        }
        if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder;
        try {
          const doc = await this.categories.updateById(id, set);
          if (!doc) throw AppError.notFound('Category');
          return toCategory(doc);
        } catch (error) {
          throw this.mapDuplicateName(error);
        }
      },
      (category, revision) => ({ type: 'menu.category.upserted', revision, category }),
    );
  }

  delete(id: string): Promise<void> {
    return this.changes.commit(
      async () => {
        const category = await this.categories.findById(id);
        if (!category) throw AppError.notFound('Category');
        const itemCount = await this.items.countInCategory(id);
        if (itemCount > 0) {
          throw new AppError(
            409,
            'CATEGORY_NOT_EMPTY',
            'Move or delete the items in this category first',
            { itemCount },
          );
        }
        await this.categories.deleteById(id);
      },
      (_result, revision) => ({ type: 'menu.category.deleted', revision, id }),
    );
  }

  private mapDuplicateName(error: unknown): unknown {
    return isDuplicateKey(error)
      ? new AppError(409, 'DUPLICATE_NAME', 'A category with this name already exists')
      : error;
  }
}
