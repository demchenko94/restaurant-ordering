import { TestBed } from '@angular/core/testing';
import { CatalogSkeletonComponent } from './catalog-skeleton.component';

describe('CatalogSkeletonComponent', () => {
  it('renders category headers followed by item rows', async () => {
    const fixture = TestBed.createComponent(CatalogSkeletonComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute('aria-label')).toBe('Loading menu');
    expect(el.querySelectorAll('.header')).toHaveLength(2);
    expect(el.querySelectorAll('.item')).toHaveLength(11);
  });
});
