import {
  type EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { SseClient } from '@restaurant/web/core';
import { MenuStore } from '@restaurant/web/menu-data-access';
import { OrdersStore } from '@restaurant/web/orders-data-access';

/**
 * Connects the server event stream to the stores. Menu events update the menu (and through
 * computed joins, the cart); order events update the orders list; a reconnect or `resync`
 * reloads whatever the user has already opened.
 */
export function provideRealtime(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      const sse = inject(SseClient);
      const menu = inject(MenuStore);
      const orders = inject(OrdersStore);

      const resync = () => {
        if (menu.status() !== 'idle') menu.refresh();
        if (orders.status() !== 'idle') orders.loadFirstPage();
      };

      sse.onEvent((event) => {
        if (event.type === 'resync') {
          resync();
          return;
        }
        menu.applyEvent(event);
        orders.applyEvent(event);
      });
      sse.onReconnect(resync);
      sse.start();
    }),
  ]);
}
