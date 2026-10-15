import { fixedItem, id, openItem } from '@restaurant/web/menu-data-access';
import { toCartLineView } from './cart.view';

const cat = id(1);

describe('toCartLineView', () => {
  it('prices a fixed-price line from the live item', () => {
    const view = toCartLineView(
      { key: id(10), itemId: id(10), quantity: 3, seenPriceCents: 950 },
      fixedItem(10, cat, 950),
    );
    expect(view).toMatchObject({
      status: 'ok',
      unitPriceCents: 950,
      lineTotalCents: 2850,
      orderable: true,
    });
  });

  it('flags a price that changed since the user saw it', () => {
    const view = toCartLineView(
      { key: id(10), itemId: id(10), quantity: 1, seenPriceCents: 900 },
      fixedItem(10, cat, 950),
    );
    expect(view).toMatchObject({ status: 'price-changed', unitPriceCents: 950, orderable: true });
  });

  it('uses the entered price for open-price items', () => {
    const view = toCartLineView(
      { key: `${id(12)}:1500`, itemId: id(12), quantity: 2, unitPriceCents: 1500 },
      openItem(12, cat),
    );
    expect(view).toMatchObject({ status: 'ok', unitPriceCents: 1500, lineTotalCents: 3000 });
  });

  it('marks unavailable and removed items as not orderable', () => {
    const line = { key: id(10), itemId: id(10), quantity: 1 };
    expect(toCartLineView(line, fixedItem(10, cat, 950, false))).toMatchObject({
      status: 'unavailable',
      orderable: false,
      lineTotalCents: 0,
    });
    expect(toCartLineView(line, null)).toMatchObject({ status: 'removed', orderable: false });
  });
});
