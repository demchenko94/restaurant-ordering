import { inject, Injectable, Injector } from '@angular/core';
import type { ApiErrorView } from '../errors/api-error-view';
import { errorSummary } from '../errors/error-messages';

/** Snackbar notifications. Angular Material's snack bar is loaded on first use, not at startup. */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly injector = inject(Injector);

  info(message: string): void {
    void this.show(message, 'OK', { duration: 3000 });
  }

  error(error: ApiErrorView | string): void {
    const message = typeof error === 'string' ? error : errorSummary(error);
    void this.show(message, 'Dismiss', { duration: 6000, politeness: 'assertive' });
  }

  private async show(
    message: string,
    action: string,
    config: { duration: number; politeness?: 'assertive' | 'polite' | 'off' },
  ): Promise<void> {
    const { MatSnackBar } = await import('@angular/material/snack-bar');
    this.injector.get(MatSnackBar).open(message, action, config);
  }
}
