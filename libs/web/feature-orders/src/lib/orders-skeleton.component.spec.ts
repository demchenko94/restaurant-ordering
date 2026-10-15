import { TestBed } from '@angular/core/testing';
import { OrdersSkeletonComponent } from './orders-skeleton.component';

describe('OrdersSkeletonComponent', () => {
  it('announces loading and renders row placeholders', async () => {
    const fixture = TestBed.createComponent(OrdersSkeletonComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-label')).toBe('Loading orders');
    expect(el.querySelectorAll('.row')).toHaveLength(8);
    expect(el.querySelectorAll('.row:first-child app-skeleton-bar')).toHaveLength(5);
  });
});
