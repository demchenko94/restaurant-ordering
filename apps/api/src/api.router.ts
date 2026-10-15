import { Router } from 'express';
import { createCategoryRouter } from './features/categories/category.router';
import type { CategoryService } from './features/categories/category.service';
import { createCheckoutRouter } from './features/checkout/checkout.router';
import type { CheckoutService } from './features/checkout/checkout.service';
import type { EventBus } from './features/events/event-bus';
import { createEventsRouter } from './features/events/events.router';
import { createHealthRouter } from './features/health/health.router';
import { createItemRouter } from './features/items/item.router';
import type { ItemService } from './features/items/item.service';
import { createMenuRouter } from './features/menu/menu.router';
import type { MenuService } from './features/menu/menu.service';
import { createOrderRouter } from './features/orders/order.router';
import type { OrderService } from './features/orders/order.service';

/** What the HTTP layer needs from the composition root. */
export interface ApiServices {
  bus: EventBus;
  menu: MenuService;
  categories: CategoryService;
  items: ItemService;
  checkout: CheckoutService;
  orders: OrderService;
}

/** Mounts every feature router under one `/api` router. */
export function createApiRouter(services: ApiServices): Router {
  const router = Router();
  router.use(createHealthRouter());
  router.use(createMenuRouter(services.menu));
  router.use(createCategoryRouter(services.categories));
  router.use(createItemRouter(services.items));
  router.use(createCheckoutRouter(services.checkout));
  router.use(createOrderRouter(services.orders));
  router.use(createEventsRouter(services.bus));
  return router;
}
