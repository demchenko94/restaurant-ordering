import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
    <h2>{{ title() }}</h2>
    @if (hint()) {
      <p>{{ hint() }}</p>
    }
    <ng-content />
  `,
  styleUrl: './state-views.component.scss',
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly hint = input<string>();
}

@Component({
  selector: 'app-error-state',
  imports: [MatIcon, MatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'alert' },
  template: `
    <mat-icon aria-hidden="true">error_outline</mat-icon>
    <h2>{{ title() }}</h2>
    @if (reference()) {
      <p>Reference: {{ reference() }}</p>
    }
    @if (actionLabel()) {
      <button mat-flat-button type="button" (click)="retry.emit()">{{ actionLabel() }}</button>
    }
  `,
  styleUrl: './state-views.component.scss',
})
export class ErrorStateComponent {
  readonly title = input.required<string>();
  readonly reference = input<string>();
  readonly actionLabel = input<string>('Retry');
  readonly retry = output<void>();
}
