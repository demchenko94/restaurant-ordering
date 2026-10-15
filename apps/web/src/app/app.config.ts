import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { provideCore } from '@restaurant/web/core';
import { appRoutes } from './app.routes';
import { IdlePreloadStrategy } from './idle-preload.strategy';
import { provideRealtime } from './realtime';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding(), withPreloading(IdlePreloadStrategy)),
    provideCore(),
    provideRealtime(),
  ],
};
