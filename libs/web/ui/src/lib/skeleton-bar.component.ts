import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A single pulsing placeholder shape. Compose several to mirror the layout of a real row. */
@Component({
  selector: 'app-skeleton-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[style.border-radius]': 'radius()',
  },
  template: '',
  styles: `
    :host {
      display: block;
      max-width: 100%;
      background: var(--mat-sys-surface-container-high);
      animation: pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse {
      50% {
        opacity: 0.45;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `,
})
export class SkeletonBarComponent {
  readonly width = input('100%');
  readonly height = input('14px');
  readonly radius = input('7px');
}
