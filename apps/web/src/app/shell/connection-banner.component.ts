import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { ConnectionStore } from '@restaurant/web/core';

/** Overlays the top of the page (never pushes content down, so it causes no layout shift). */
@Component({
  selector: 'app-connection-banner',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <div class="banner" role="status" [class.offline]="store.health() === 'offline'">
        <mat-icon aria-hidden="true">{{
          store.health() === 'offline' ? 'cloud_off' : 'sync'
        }}</mat-icon>
        {{ text }}
      </div>
    }
  `,
  styles: `
    .banner {
      position: fixed;
      z-index: 1000;
      left: 50%;
      bottom: 16px;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: calc(100vw - 32px);
      padding: 10px 16px;
      border-radius: 12px;
      background: var(--mat-sys-inverse-surface);
      color: var(--mat-sys-inverse-on-surface);
      box-shadow: var(--mat-sys-level3);
      font: var(--mat-sys-label-large);
    }
    .offline {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class ConnectionBannerComponent {
  protected readonly store = inject(ConnectionStore);
  protected readonly message = computed(() => {
    switch (this.store.health()) {
      case 'offline':
        return "You're offline. Changes can't be saved until the connection is back.";
      case 'degraded':
        return this.store.sse() === 'connecting' ? null : 'Live updates paused, reconnecting…';
      default:
        return null;
    }
  });
}
