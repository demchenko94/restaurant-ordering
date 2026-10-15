import { TestBed } from '@angular/core/testing';
import { CategoryListSkeletonComponent } from './categories/category-list-skeleton.component';
import { ItemListSkeletonComponent } from './items/item-list-skeleton.component';

describe('Setup skeletons', () => {
  it('category pane: add form plus category rows', async () => {
    const fixture = TestBed.createComponent(CategoryListSkeletonComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute('aria-label')).toBe('Loading categories');
    expect(el.querySelectorAll('li')).toHaveLength(8);
    expect(el.querySelector('.add')).not.toBeNull();
  });

  it('item pane: header, column titles and rows', async () => {
    const fixture = TestBed.createComponent(ItemListSkeletonComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute('aria-label')).toBe('Loading items');
    expect(el.querySelector('header')).not.toBeNull();
    expect(el.querySelector('.columns')).not.toBeNull();
    expect(el.querySelectorAll('.row')).toHaveLength(10);
  });
});
