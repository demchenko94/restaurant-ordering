import { Router } from 'express';
import { OrderController } from './order.controller';
import type { OrderService } from './order.service';

export function createOrderRouter(service: OrderService): Router {
  const controller = new OrderController(service);
  const router = Router();
  router.post('/orders', controller.place);
  router.get('/orders', controller.list);
  router.get('/orders/:id', controller.get);
  router.patch('/orders/:id/status', controller.setStatus);
  return router;
}
