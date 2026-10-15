import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MAX_QTY } from '@restaurant/contracts';

@Component({
  selector: 'app-quantity-stepper',
  imports: [MatIconButton, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      type="button"
      [attr.aria-label]="'Decrease quantity of ' + label()"
      (click)="changed.emit(value() - 1)"
    >
      <mat-icon>{{ value() <= 1 && removable() ? 'delete' : 'remove' }}</mat-icon>
    </button>
    <span class="value" aria-live="polite" [attr.aria-label]="value() + ' of ' + label()">{{
      value()
    }}</span>
    <button
      mat-icon-button
      type="button"
      [attr.aria-label]="'Increase quantity of ' + label()"
      [disabled]="value() >= max"
      (click)="changed.emit(value() + 1)"
    >
      <mat-icon>add</mat-icon>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }
    .value {
      min-width: 28px;
      text-align: center;
      font: var(--mat-sys-label-large);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class QuantityStepperComponent {
  readonly value = input.required<number>();
  readonly label = input.required<string>();
  /** When true, stepping below 1 shows a bin icon (the parent removes the line). */
  readonly removable = input(true);
  readonly changed = output<number>();
  protected readonly max = MAX_QTY;
}
