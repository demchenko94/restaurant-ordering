import { Router } from 'express';
import { CategoryController } from './category.controller';
import type { CategoryService } from './category.service';

export function createCategoryRouter(service: CategoryService): Router {
  const controller = new CategoryController(service);
  const router = Router();
  router.post('/categories', controller.create);
  router.patch('/categories/:id', controller.update);
  router.delete('/categories/:id', controller.remove);
  return router;
}
