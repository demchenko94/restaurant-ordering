import { Injectable } from '@angular/core';
import type { PreloadingStrategy, Route } from '@angular/router';
import { Observable, type Subscription } from 'rxjs';

/** Loads lazy routes in the browser's idle time, so first paint stays small yet navigation is fast. */
@Injectable({ providedIn: 'root' })
export class IdlePreloadStrategy implements PreloadingStrategy {
  preload(_route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return new Observable<unknown>((subscriber) => {
      let loading: Subscription | undefined;
      const run = () => {
        loading = load().subscribe(subscriber);
      };
      const idle = typeof requestIdleCallback === 'function';
      const handle = idle ? requestIdleCallback(run, { timeout: 5000 }) : setTimeout(run, 2000);
      return () => {
        if (idle) cancelIdleCallback(handle as number);
        else clearTimeout(handle as ReturnType<typeof setTimeout>);
        loading?.unsubscribe();
      };
    });
  }
}
