import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SkeletonBarComponent } from '@restaurant/web/ui';

/** Loading placeholder for the item table: header, column titles and rows on the real grid. */
@Component({
  selector: 'app-item-list-skeleton',
  imports: [SkeletonBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-label': 'Loading items' },
  template: `
    <header>
      <app-skeleton-bar width="140px" height="26px" />
      <app-skeleton-bar width="56px" height="12px" />
      <span class="spacer"></span>
      <app-skeleton-bar width="116px" height="40px" radius="20px" />
    </header>
    <div class="columns">
      <app-skeleton-bar width="44px" height="11px" />
      <app-skeleton-bar width="40px" height="11px" class="end" />
      <app-skeleton-bar width="58px" height="11px" class="center" />
      <span></span>
    </div>
    @for (row of rows; track row) {
      <div class="row">
        <div class="name">
          <app-skeleton-bar [width]="names[row % names.length]" height="15px" />
          <app-skeleton-bar [width]="descriptions[row % descriptions.length]" height="11px" />
        </div>
        <app-skeleton-bar height="40px" radius="8px" />
        <app-skeleton-bar width="52px" height="32px" radius="16px" class="center" />
        <div class="actions">
          <app-skeleton-bar width="24px" height="24px" radius="50%" />
          <app-skeleton-bar width="24px" height="24px" radius="50%" />
        </div>
      </div>
    }
  `,
  styles: `
    @use 'rows';

    :host {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 12px;
    }
    .spacer {
      flex: 1;
    }
    .columns {
      @include rows.setup-columns;
      height: 36px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .row {
      @include rows.setup-row;
    }
    .name {
      display: flex;
      flex-direction: column;
      gap: 7px;
      min-width: 0;
    }
    .end {
      justify-self: end;
    }
    .center {
      justify-self: center;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
    }
  `,
})
export class ItemListSkeletonComponent {
  protected readonly rows = Array.from({ length: 10 }, (_, i) => i);
  protected readonly names = ['42%', '56%', '34%', '48%', '62%'];
  protected readonly descriptions = ['66%', '52%', '74%', '58%'];
}
