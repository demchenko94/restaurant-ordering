import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { type EnvironmentProviders, ErrorHandler, makeEnvironmentProviders } from '@angular/core';
import { GlobalErrorHandler } from './errors/global-error-handler';
import {
  errorInterceptor,
  requestIdInterceptor,
  retryInterceptor,
  timeoutInterceptor,
} from './http/interceptors';

/** HttpClient with the resilience chain + the global error handler. */
export function provideCore(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(
      withFetch(),
      // Order matters: responses travel back through this list in reverse, so timeout and retry
      // see raw errors and the error interceptor normalizes whatever finally escapes.
      withInterceptors([
        requestIdInterceptor,
        errorInterceptor,
        retryInterceptor,
        timeoutInterceptor,
      ]),
    ),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ]);
}
