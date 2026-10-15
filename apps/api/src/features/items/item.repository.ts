import { Types } from 'mongoose';
import { ItemModel, type ItemDoc } from './item.entity';

export type ItemData = Pick<
  ItemDoc,
  'categoryId' | 'name' | 'description' | 'priceCents' | 'openPrice' | 'available' | 'sortOrder'
>;

export interface ItemUpdate {
  set: Partial<ItemData>;
  unset?: (keyof ItemData)[];
}

export class ItemRepository {
  findAll(): Promise<ItemDoc[]> {
    return ItemModel.find().sort({ categoryId: 1, sortOrder: 1, name: 1 }).lean();
  }

  findByIds(ids: string[]): Promise<ItemDoc[]> {
    return ItemModel.find({ _id: { $in: ids } }).lean();
  }

  findById(id: string): Promise<ItemDoc | null> {
    return ItemModel.findById(id).lean();
  }

  countInCategory(categoryId: string): Promise<number> {
    return ItemModel.countDocuments({ categoryId: new Types.ObjectId(categoryId) });
  }

  /** Highest `sortOrder` inside the category, or -1 when it is empty. */
  async lastSortOrderIn(categoryId: string): Promise<number> {
    const last = await ItemModel.findOne({ categoryId }).sort({ sortOrder: -1 }).lean();
    return last?.sortOrder ?? -1;
  }

  async create(data: ItemData): Promise<ItemDoc> {
    const doc = await ItemModel.create(data);
    return doc.toObject();
  }

  updateById(id: string, { set, unset }: ItemUpdate): Promise<ItemDoc | null> {
    const unsetFields = unset ? Object.fromEntries(unset.map((field) => [field, 1])) : undefined;
    return ItemModel.findByIdAndUpdate(
      id,
      { $set: set, ...(unsetFields ? { $unset: unsetFields } : {}) },
      { returnDocument: 'after', runValidators: true },
    ).lean();
  }

  /** Returns false when nothing was deleted. */
  async deleteById(id: string): Promise<boolean> {
    const result = await ItemModel.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }
}
