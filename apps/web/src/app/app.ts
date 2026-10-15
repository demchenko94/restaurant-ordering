import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatToolbar } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ConnectionStore } from '@restaurant/web/core';
import { ConnectionBannerComponent } from './shell/connection-banner.component';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbar, ConnectionBannerComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly connection = inject(ConnectionStore);
  protected readonly links = [
    { path: '/menu', label: 'Menu' },
    { path: '/orders', label: 'Orders' },
    { path: '/setup', label: 'Setup' },
  ] as const;
}
