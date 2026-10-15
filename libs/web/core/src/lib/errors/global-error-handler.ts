import { ErrorHandler, inject, Injectable } from '@angular/core';
import { isApiErrorView } from './api-error-view';
import { NotifyService } from '../notifications/notify.service';

const BURST_WINDOW_MS = 5000;

/** Logs unexpected errors and tells the user once per burst, so one bug can't spam snackbars. */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly notify = inject(NotifyService);
  private lastShownAt = 0;

  handleError(error: unknown): void {
    console.error(error);
    // API failures are surfaced by the feature that made the request.
    if (isApiErrorView(error)) return;
    const now = Date.now();
    if (now - this.lastShownAt > BURST_WINDOW_MS) {
      this.lastShownAt = now;
      this.notify.error('Something unexpected happened. Please try again.');
    }
  }
}
