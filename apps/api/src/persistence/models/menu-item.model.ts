import { ITEM_DESCRIPTION_MAX, ITEM_NAME_MAX, MAX_PRICE_CENTS } from '@restaurant/contracts';
import { model, Schema, type Types } from 'mongoose';

export interface MenuItemDoc {
  _id: Types.ObjectId;
  categoryId: Types.ObjectId;
  name: string;
  description?: string;
  priceCents: number | null;
  openPrice: boolean;
  available: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const menuItemSchema = new Schema<MenuItemDoc>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    name: { type: String, required: true, trim: true, maxlength: ITEM_NAME_MAX },
    description: { type: String, trim: true, maxlength: ITEM_DESCRIPTION_MAX },
    priceCents: { type: Number, default: null, min: 1, max: MAX_PRICE_CENTS },
    openPrice: { type: Boolean, required: true, default: false },
    available: { type: Boolean, required: true, default: true },
    sortOrder: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

menuItemSchema.index({ categoryId: 1, sortOrder: 1 });
menuItemSchema.index({ name: 'text' });

// Invariant: a price exists if and only if the item is not open-price.
menuItemSchema.pre('validate', function () {
  if (this.openPrice && this.priceCents !== null && this.priceCents !== undefined) {
    this.invalidate('priceCents', 'Open-price items must not have a price');
  }
  if (!this.openPrice && (this.priceCents === null || this.priceCents === undefined)) {
    this.invalidate('priceCents', 'Fixed-price items require a price');
  }
});

export const MenuItemModel = model<MenuItemDoc>('MenuItem', menuItemSchema, 'menu_items');
