import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Placeholder rows with the same height as real rows, so loading causes no layout shift. */
@Component({
  selector: 'app-skeleton-rows',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-label': 'Loading', '[style.--row-height.px]': 'rowHeight()' },
  template: `
    @for (row of rows(); track row) {
      <div class="row"><span class="bar wide"></span><span class="bar narrow"></span></div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .row {
      height: calc(var(--row-height, 64) * 1px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .bar {
      height: 14px;
      border-radius: 7px;
      background: var(--mat-sys-surface-container-high);
      animation: pulse 1.4s ease-in-out infinite;
    }
    .wide {
      width: 45%;
    }
    .narrow {
      width: 70px;
    }
    @keyframes pulse {
      50% {
        opacity: 0.45;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bar {
        animation: none;
      }
    }
  `,
})
export class SkeletonRowsComponent {
  readonly count = input(8);
  readonly rowHeight = input(64);
  protected readonly rows = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
