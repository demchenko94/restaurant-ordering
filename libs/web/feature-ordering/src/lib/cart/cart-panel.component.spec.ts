import { TestBed } from '@angular/core/testing';
import { category, fixedItem, id, MenuStore, openItem } from '@restaurant/web/menu-data-access';
import { CartPanelComponent } from './cart-panel.component';
import { CartStore } from './cart.store';

const cat = id(1);
const pizza = fixedItem(10, cat, 950);
const special = openItem(12, cat);

describe('CartPanelComponent', () => {
  let cart: InstanceType<typeof CartStore>;
  let menu: InstanceType<typeof MenuStore>;

  const render = async () => {
    const fixture = TestBed.createComponent(CartPanelComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    menu = TestBed.inject(MenuStore);
    menu.setSnapshot({ revision: 1, categories: [category(1)], items: [pizza, special] });
    cart = TestBed.inject(CartStore);
  });

  it('invites the user to add items when empty', async () => {
    const el = await render();
    expect(el.textContent).toContain('Add items from the menu');
    expect(el.querySelector('.checkout')).toBeNull();
  });

  it('lists lines with formatted prices and totals', async () => {
    cart.add(pizza, 2);
    cart.add(special, 1, 1500);
    const el = await render();
    const text = el.textContent ?? '';
    expect(text).toContain('Item 10');
    expect(text).toContain('$19.00');
    expect(text).toContain('Open 12');
    expect(text).toContain('$15.00');
    expect(el.querySelector('.totals .total')?.textContent).toContain('$34.00');
    expect((el.querySelector('.checkout') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows a notice and offers fixes when the menu changes under the cart', async () => {
    cart.add(pizza);
    menu.applyEvent({
      type: 'menu.item.upserted',
      revision: 2,
      item: fixedItem(10, cat, 1200, false),
    });
    const el = await render();
    expect(el.querySelector('.notice')?.textContent).toContain('no longer available');
    expect(el.querySelector('.lines li.bad')).not.toBeNull();
    expect((el.querySelector('.checkout') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables checkout and explains when the discount exceeds the subtotal', async () => {
    cart.add(pizza);
    cart.setDiscount(5000);
    const el = await render();
    expect(el.querySelector('#discount-error')?.textContent).toContain('Discount');
    expect((el.querySelector('.checkout') as HTMLButtonElement).disabled).toBe(true);
  });
});
