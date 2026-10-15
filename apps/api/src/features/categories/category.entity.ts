import { CATEGORY_NAME_MAX, type Category } from '@restaurant/contracts';
import { model, Schema, type Types } from 'mongoose';

export interface CategoryDoc {
  _id: Types.ObjectId;
  name: string;
  nameKey: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: CATEGORY_NAME_MAX },
    nameKey: { type: String, required: true, unique: true },
    sortOrder: { type: Number, required: true, default: 0, index: true },
  },
  { timestamps: true },
);

export const CategoryModel = model<CategoryDoc>('Category', categorySchema, 'categories');

export function toCategory(doc: CategoryDoc): Category {
  return { id: doc._id.toHexString(), name: doc.name, sortOrder: doc.sortOrder };
}
