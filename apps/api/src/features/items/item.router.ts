import { Router } from 'express';
import { ItemController } from './item.controller';
import type { ItemService } from './item.service';

export function createItemRouter(service: ItemService): Router {
  const controller = new ItemController(service);
  const router = Router();
  router.post('/items', controller.create);
  router.patch('/items/:id', controller.update);
  router.delete('/items/:id', controller.remove);
  return router;
}
