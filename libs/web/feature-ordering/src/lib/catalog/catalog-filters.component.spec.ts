import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { category } from '@restaurant/web/menu-data-access';
import { CatalogFiltersComponent } from './catalog-filters.component';

@Component({
  imports: [CatalogFiltersComponent],
  template: `<app-catalog-filters
    [categories]="categories"
    [selectedId]="selected()"
    [query]="query()"
    (queryChange)="query.set($event)"
    (categorySelected)="picked.set($event)"
  />`,
})
class HostComponent {
  categories = [category(1, 'Pizza'), category(2, 'Pasta')];
  selected = signal<string | null>(null);
  query = signal('');
  picked = signal<string | null | undefined>(undefined);
}

describe('CatalogFiltersComponent', () => {
  const setup = async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
  };

  it('renders an "All" chip and one chip per category, marking the selected one', async () => {
    const { fixture, el, host } = await setup();
    host.selected.set('00000000000000000000000' + '2');
    await fixture.whenStable();
    const chips = [...el.querySelectorAll('.chip')];
    expect(chips.map((c) => c.textContent?.trim())).toEqual(['All', 'Pizza', 'Pasta']);
    expect(chips[2].getAttribute('aria-pressed')).toBe('true');
    expect(chips[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('emits the chosen category (or null for All)', async () => {
    const { el, host } = await setup();
    (el.querySelectorAll('.chip')[1] as HTMLButtonElement).click();
    expect(host.picked()).toBe(host.categories[0].id);
    (el.querySelectorAll('.chip')[0] as HTMLButtonElement).click();
    expect(host.picked()).toBeNull();
  });

  it('debounces typing into the query', async () => {
    const { fixture, el, host } = await setup();
    const input = el.querySelector('input') as HTMLInputElement;
    input.value = 'piz';
    input.dispatchEvent(new Event('input'));
    input.value = 'pizza';
    input.dispatchEvent(new Event('input'));
    expect(host.query()).toBe('');
    await new Promise((resolve) => setTimeout(resolve, 250));
    await fixture.whenStable();
    expect(host.query()).toBe('pizza');
  });

  it('shows a query set from outside (URL, "clear filters")', async () => {
    const { fixture, el, host } = await setup();
    host.query.set('soup');
    await fixture.whenStable();
    expect((el.querySelector('input') as HTMLInputElement).value).toBe('soup');
    host.query.set('');
    await fixture.whenStable();
    expect((el.querySelector('input') as HTMLInputElement).value).toBe('');
  });
});
