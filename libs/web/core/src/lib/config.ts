import { InjectionToken } from '@angular/core';

/** Base URL of the REST API. The dev server proxies `/api` to the Express server. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
