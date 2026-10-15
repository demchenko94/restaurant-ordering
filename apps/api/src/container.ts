import type { ApiServices } from './api.router';
import { CounterRepository } from './database/counter.repository';
import { CategoryRepository } from './features/categories/category.repository';
import { CategoryService } from './features/categories/category.service';
import { CheckoutService } from './features/checkout/checkout.service';
import { EventBus } from './features/events/event-bus';
import { ItemRepository } from './features/items/item.repository';
import { ItemService } from './features/items/item.service';
import { MenuChanges } from './features/menu/menu-changes';
import { MenuService } from './features/menu/menu.service';
import { OrderRepository } from './features/orders/order.repository';
import { OrderService } from './features/orders/order.service';
import { OrderSimulator, type SimulatorLogger } from './features/orders/order-simulator';

export interface ContainerOptions {
  eventBufferSize: number;
  simulatorStepMs: number;
  logger: SimulatorLogger;
}

export interface Container extends ApiServices {
  simulator: OrderSimulator;
  dispose(): void;
}

/**
 * Composition root: the only place that knows how features are wired together
 * (repositories → services). Requires the mongoose connection to be usable.
 */
export function createContainer(options: ContainerOptions): Container {
  const bus = new EventBus(options.eventBufferSize);

  const counters = new CounterRepository();
  const categoryRepository = new CategoryRepository();
  const itemRepository = new ItemRepository();
  const orderRepository = new OrderRepository();

  const menuChanges = new MenuChanges(counters, bus);
  const menu = new MenuService(categoryRepository, itemRepository, menuChanges);
  const categories = new CategoryService(categoryRepository, itemRepository, menuChanges);
  const items = new ItemService(itemRepository, categoryRepository, menuChanges);
  const checkout = new CheckoutService(itemRepository, categoryRepository, counters);
  const orders = new OrderService(orderRepository, counters, checkout, bus);

  const simulator = new OrderSimulator(orders, options.simulatorStepMs, options.logger);
  const detach = simulator.attach(bus);

  return {
    bus,
    menu,
    categories,
    items,
    checkout,
    orders,
    simulator,
    dispose: () => {
      detach();
      simulator.stop();
    },
  };
}
