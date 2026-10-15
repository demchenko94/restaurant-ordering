import { EventBus } from './realtime/event-bus';
import { OrderSimulator, type SimulatorLogger } from './simulator/order-simulator';
import { CheckoutService } from './services/checkout.service';
import { MenuService } from './services/menu.service';
import { OrdersService } from './services/orders.service';
import type { Services } from './http/routes';

export interface ContainerOptions {
  eventBufferSize: number;
  simulatorStepMs: number;
  logger: SimulatorLogger;
}

export interface Container extends Services {
  simulator: OrderSimulator;
  dispose(): void;
}

/** Wires services together. Requires the mongoose connection to be usable. */
export function createContainer(options: ContainerOptions): Container {
  const bus = new EventBus(options.eventBufferSize);
  const menu = new MenuService(bus);
  const checkout = new CheckoutService();
  const orders = new OrdersService(bus, checkout);
  const simulator = new OrderSimulator(orders, options.simulatorStepMs, options.logger);
  const detach = simulator.attach(bus);

  return {
    bus,
    menu,
    checkout,
    orders,
    simulator,
    dispose: () => {
      detach();
      simulator.stop();
    },
  };
}
