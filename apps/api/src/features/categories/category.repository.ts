import { CategoryModel, type CategoryDoc } from './category.entity';

export class CategoryRepository {
  findAll(): Promise<CategoryDoc[]> {
    return CategoryModel.find().sort({ sortOrder: 1, name: 1 }).lean();
  }

  findById(id: string): Promise<CategoryDoc | null> {
    return CategoryModel.findById(id).lean();
  }

  async exists(id: string): Promise<boolean> {
    return (await CategoryModel.exists({ _id: id })) !== null;
  }

  /** Highest `sortOrder`, or -1 when there are no categories yet. */
  async lastSortOrder(): Promise<number> {
    const last = await CategoryModel.findOne().sort({ sortOrder: -1 }).lean();
    return last?.sortOrder ?? -1;
  }

  async create(data: Pick<CategoryDoc, 'name' | 'nameKey' | 'sortOrder'>): Promise<CategoryDoc> {
    const doc = await CategoryModel.create(data);
    return doc.toObject();
  }

  updateById(
    id: string,
    set: Partial<Pick<CategoryDoc, 'name' | 'nameKey' | 'sortOrder'>>,
  ): Promise<CategoryDoc | null> {
    return CategoryModel.findByIdAndUpdate(id, set, {
      returnDocument: 'after',
      runValidators: true,
    }).lean();
  }

  async deleteById(id: string): Promise<void> {
    await CategoryModel.deleteOne({ _id: id });
  }
}
