import { TestBed } from '@angular/core/testing';
import { category, fixedItem, id, MenuStore, openItem } from '@restaurant/web/menu-data-access';
import { CartStore } from './cart.store';

const cat = id(1);
const pizza = fixedItem(10, cat, 950);
const soup = fixedItem(11, cat, 600);
const special = openItem(12, cat);

describe('CartStore', () => {
  let cart: InstanceType<typeof CartStore>;
  let menu: InstanceType<typeof MenuStore>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    menu = TestBed.inject(MenuStore);
    menu.setSnapshot({ revision: 1, categories: [category(1)], items: [pizza, soup, special] });
    cart = TestBed.inject(CartStore);
  });

  it('merges repeated adds of a fixed-price item and caps the quantity', () => {
    cart.add(pizza);
    cart.add(pizza, 2);
    expect(cart.lines()).toHaveLength(1);
    expect(cart.lines()[0].quantity).toBe(3);
    cart.add(pizza, 500);
    expect(cart.lines()[0].quantity).toBe(99);
  });

  it('keeps open-price lines apart by entered price and ignores a missing price', () => {
    cart.add(special, 1, 1500);
    cart.add(special, 1, 1500);
    cart.add(special, 1, 2000);
    cart.add(special);
    expect(cart.lines().map((l) => [l.unitPriceCents, l.quantity])).toEqual([
      [1500, 2],
      [2000, 1],
    ]);
  });

  it('joins lines with the live menu to compute totals', () => {
    cart.add(pizza, 2);
    cart.add(special, 1, 1500);
    expect(cart.subtotalCents()).toBe(3400);
    cart.setDiscount(400);
    expect(cart.totalCents()).toBe(3000);
    expect(cart.count()).toBe(3);
  });

  it('follows live price changes and flags them until accepted', () => {
    cart.add(pizza);
    menu.applyEvent({ type: 'menu.item.upserted', revision: 2, item: fixedItem(10, cat, 1200) });
    const view = cart.views()[0];
    expect(view).toMatchObject({
      status: 'price-changed',
      unitPriceCents: 1200,
      lineTotalCents: 1200,
    });
    expect(cart.hasPriceChanges()).toBe(true);
    expect(cart.subtotalCents()).toBe(1200);

    cart.acknowledgePrices();
    expect(cart.views()[0].status).toBe('ok');
    expect(cart.hasPriceChanges()).toBe(false);
  });

  it('excludes unavailable and removed items from the totals', () => {
    cart.add(pizza);
    cart.add(soup);
    menu.applyEvent({
      type: 'menu.item.upserted',
      revision: 2,
      item: fixedItem(10, cat, 950, false),
    });
    menu.applyEvent({ type: 'menu.item.deleted', revision: 3, id: soup.id });
    expect(cart.views().map((v) => v.status)).toEqual(['unavailable', 'removed']);
    expect(cart.subtotalCents()).toBe(0);
    expect(cart.hasUnavailable()).toBe(true);

    cart.removeUnavailable();
    expect(cart.isEmpty()).toBe(true);
  });

  it('flags a discount above the subtotal', () => {
    cart.add(pizza);
    cart.setDiscount(951);
    expect(cart.discountError()).not.toBeNull();
    cart.setDiscount(950);
    expect(cart.discountError()).toBeNull();
    expect(cart.totalCents()).toBe(0);
  });

  it('changes quantity, removing the line at zero', () => {
    cart.add(pizza);
    cart.setQuantity(pizza.id, 4);
    expect(cart.quantityByItem().get(pizza.id)).toBe(4);
    cart.setQuantity(pizza.id, 0);
    expect(cart.isEmpty()).toBe(true);
  });

  it('survives a reload through localStorage', () => {
    cart.add(pizza, 2);
    cart.setDiscount(100);
    TestBed.flushEffects?.();
    TestBed.tick();

    TestBed.resetTestingModule();
    TestBed.inject(MenuStore).setSnapshot({
      revision: 1,
      categories: [category(1)],
      items: [pizza],
    });
    const restored = TestBed.inject(CartStore);
    expect(restored.lines()[0]).toMatchObject({ itemId: pizza.id, quantity: 2 });
    expect(restored.discountCents()).toBe(100);
  });

  it('drops malformed persisted lines', () => {
    localStorage.setItem(
      'restaurant.cart.v1',
      JSON.stringify({
        lines: [
          { key: 'x', itemId: 'not-an-id', quantity: 1 },
          { key: pizza.id, itemId: pizza.id, quantity: 0 },
          { key: pizza.id, itemId: pizza.id, quantity: 2 },
        ],
        discountCents: -5,
      }),
    );
    TestBed.resetTestingModule();
    TestBed.inject(MenuStore).setSnapshot({ revision: 1, categories: [], items: [pizza] });
    const restored = TestBed.inject(CartStore);
    expect(restored.lines()).toHaveLength(1);
    expect(restored.lines()[0].quantity).toBe(2);
    expect(restored.discountCents()).toBe(0);
  });
});
