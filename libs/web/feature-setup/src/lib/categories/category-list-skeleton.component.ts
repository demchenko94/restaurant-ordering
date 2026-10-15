import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SkeletonBarComponent } from '@restaurant/web/ui';

/** Loading placeholder for the category pane: the add form and a column of category rows. */
@Component({
  selector: 'app-category-list-skeleton',
  imports: [SkeletonBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-label': 'Loading categories' },
  template: `
    <div class="add">
      <app-skeleton-bar height="40px" radius="8px" />
      <app-skeleton-bar width="64px" height="40px" radius="20px" />
    </div>
    <ul>
      @for (width of widths; track $index) {
        <li>
          <app-skeleton-bar [width]="width" height="15px" />
          <app-skeleton-bar width="22px" height="12px" />
          <span class="icons">
            <app-skeleton-bar width="24px" height="24px" radius="50%" />
            <app-skeleton-bar width="24px" height="24px" radius="50%" />
          </span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
      overflow: hidden;
    }
    .add {
      display: flex;
      gap: 8px;
    }
    .add app-skeleton-bar:first-child {
      flex: 1;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      height: 48px;
      padding: 0 12px;
    }
    li > app-skeleton-bar:first-child {
      flex: 1;
    }
    .icons {
      display: flex;
      gap: 16px;
      margin-left: 8px;
    }
    @media (max-width: 800px) {
      ul {
        display: flex;
        gap: 8px;
        overflow: hidden;
      }
      li {
        flex: none;
        gap: 12px;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 12px;
      }
      .icons {
        display: none;
      }
    }
  `,
})
export class CategoryListSkeletonComponent {
  protected readonly widths = ['62%', '48%', '70%', '54%', '58%', '66%', '44%', '60%'];
}
