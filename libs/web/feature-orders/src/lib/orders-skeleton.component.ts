import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SkeletonBarComponent } from '@restaurant/web/ui';

/** Loading placeholder for the orders list: same grid and row height as a real order row. */
@Component({
  selector: 'app-orders-skeleton',
  imports: [SkeletonBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-label': 'Loading orders' },
  template: `
    @for (row of rows; track row) {
      <div class="row">
        <app-skeleton-bar width="36px" height="18px" />
        <div class="body">
          <app-skeleton-bar [width]="widths[row % widths.length]" />
          <app-skeleton-bar width="38%" height="11px" />
        </div>
        <app-skeleton-bar width="84px" height="24px" radius="12px" />
        <app-skeleton-bar width="56px" height="16px" />
      </div>
    }
  `,
  styles: `
    @use 'rows';

    :host {
      display: block;
    }
    .row {
      @include rows.orders-row;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    @media (max-width: 600px) {
      app-skeleton-bar:nth-child(3) {
        grid-area: s;
        justify-self: start;
      }
    }
  `,
})
export class OrdersSkeletonComponent {
  protected readonly rows = Array.from({ length: 8 }, (_, i) => i);
  /** Varied widths read as text and avoid a rigid, repeated look. */
  protected readonly widths = ['72%', '55%', '84%', '63%'];
}
