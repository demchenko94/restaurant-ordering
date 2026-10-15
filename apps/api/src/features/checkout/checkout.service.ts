import type { CheckoutQuote, CheckoutRequest, MenuItem } from '@restaurant/contracts';
import type { CounterRepository } from '../../database/counter.repository';
import type { CategoryRepository } from '../categories/category.repository';
import type { ItemRepository } from '../items/item.repository';
import { toMenuItem } from '../items/item.entity';
import { buildQuote } from './quote';

/** Loads the live menu data a cart refers to and prices it with the pure `buildQuote`. */
export class CheckoutService {
  constructor(
    private readonly items: ItemRepository,
    private readonly categories: CategoryRepository,
    private readonly counters: CounterRepository,
  ) {}

  async quote(request: CheckoutRequest): Promise<CheckoutQuote> {
    // Read the revision first: if the menu changes while we read items, the client sees a
    // revision older than the data and simply re-quotes on the event.
    const menuRevision = await this.counters.current('menuRevision');
    const ids = [...new Set(request.lines.map((l) => l.itemId))];
    const [itemDocs, categoryDocs] = await Promise.all([
      this.items.findByIds(ids),
      this.categories.findAll(),
    ]);
    const items = new Map<string, MenuItem>(
      itemDocs.map((doc) => {
        const item = toMenuItem(doc);
        return [item.id, item];
      }),
    );
    const categoryNames = new Map(categoryDocs.map((c) => [c._id.toHexString(), c.name]));
    return buildQuote({ request, items, categoryNames, menuRevision });
  }
}
