import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import type { OrderStatus } from '@restaurant/contracts';

const PRESENTATION: Record<OrderStatus, { label: string; icon: string }> = {
  placed: { label: 'Placed', icon: 'receipt_long' },
  preparing: { label: 'Preparing', icon: 'restaurant' },
  ready: { label: 'Ready', icon: 'notifications_active' },
  completed: { label: 'Completed', icon: 'check_circle' },
  cancelled: { label: 'Cancelled', icon: 'cancel' },
};

/** Status is conveyed by icon + text + colour, never colour alone. */
@Component({
  selector: 'app-status-chip',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-status]': 'status()' },
  template: `<mat-icon aria-hidden="true">{{ view().icon }}</mat-icon
    >{{ view().label }}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px 2px 6px;
      border-radius: 999px;
      font: var(--mat-sys-label-medium);
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
    }
    mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }
    :host([data-status='preparing']) {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    :host([data-status='ready']) {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    :host([data-status='cancelled']) {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class StatusChipComponent {
  readonly status = input.required<OrderStatus>();
  protected readonly view = computed(() => PRESENTATION[this.status()]);
}
