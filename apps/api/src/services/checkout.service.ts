import type { CheckoutQuote, CheckoutRequest, MenuItem } from '@restaurant/contracts';
import { buildQuote } from '../domain/quote';
import { toMenuItem } from '../persistence/mappers';
import { CategoryModel } from '../persistence/models/category.model';
import { readCounter } from '../persistence/models/counter.model';
import { MenuItemModel } from '../persistence/models/menu-item.model';

/** Loads the live menu data a cart refers to and prices it with the pure `buildQuote`. */
export class CheckoutService {
  async quote(request: CheckoutRequest): Promise<CheckoutQuote> {
    // Read the revision first: if the menu changes while we read items, the client
    // sees a revision that is older than the data, and simply re-quotes on the event.
    const menuRevision = await readCounter('menuRevision');
    const ids = [...new Set(request.lines.map((l) => l.itemId))];
    const [itemDocs, categories] = await Promise.all([
      MenuItemModel.find({ _id: { $in: ids } }).lean(),
      CategoryModel.find().lean(),
    ]);
    const items = new Map<string, MenuItem>(
      itemDocs.map((doc) => {
        const item = toMenuItem(doc);
        return [item.id, item];
      }),
    );
    const categoryNames = new Map(categories.map((c) => [c._id.toHexString(), c.name]));
    return buildQuote({ request, items, categoryNames, menuRevision });
  }
}
