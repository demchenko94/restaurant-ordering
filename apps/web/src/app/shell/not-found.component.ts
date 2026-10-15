import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '@restaurant/web/ui';

@Component({
  selector: 'app-not-found',
  imports: [EmptyStateComponent, MatButton, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-empty-state
      icon="search_off"
      title="Page not found"
      hint="The page you opened does not exist."
    >
      <a mat-flat-button routerLink="/menu">Go to the menu</a>
    </app-empty-state>
  `,
})
export class NotFoundComponent {}
