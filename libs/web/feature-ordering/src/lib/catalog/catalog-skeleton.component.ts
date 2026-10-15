import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SkeletonBarComponent } from '@restaurant/web/ui';

/** Loading placeholder for the catalog: category headers and item rows with the real grids. */
@Component({
  selector: 'app-catalog-skeleton',
  imports: [SkeletonBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-label': 'Loading menu' },
  template: `
    @for (section of sections; track $index) {
      <div class="header">
        <app-skeleton-bar [width]="section.title" height="18px" />
        <app-skeleton-bar width="28px" height="12px" />
      </div>
      @for (row of rowsOf(section.items); track row) {
        <div class="item">
          <div class="info">
            <app-skeleton-bar [width]="names[row % names.length]" height="15px" />
            <app-skeleton-bar [width]="descriptions[row % descriptions.length]" height="11px" />
          </div>
          <app-skeleton-bar width="56px" height="15px" class="price" />
          <app-skeleton-bar width="64px" height="36px" radius="18px" class="action" />
        </div>
      }
    }
  `,
  styles: `
    @use 'rows';

    :host {
      display: block;
      overflow: hidden;
    }
    .header {
      @include rows.catalog-header-row;
      align-items: end;
    }
    .item {
      @include rows.catalog-item-row;
    }
    .info {
      display: flex;
      flex-direction: column;
      gap: 7px;
      min-width: 0;
    }
    .price {
      justify-self: end;
    }
    .action {
      justify-self: end;
    }
  `,
})
export class CatalogSkeletonComponent {
  protected readonly sections = [
    { title: '88px', items: 6 },
    { title: '72px', items: 5 },
  ];
  protected readonly names = ['46%', '58%', '38%', '52%', '64%'];
  protected readonly descriptions = ['68%', '54%', '76%', '60%'];
  protected rowsOf(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i);
  }
}
