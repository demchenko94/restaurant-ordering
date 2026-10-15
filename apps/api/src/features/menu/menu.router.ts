import { Router } from 'express';
import { MenuController } from './menu.controller';
import type { MenuService } from './menu.service';

export function createMenuRouter(service: MenuService): Router {
  const controller = new MenuController(service);
  const router = Router();
  router.get('/menu', controller.get);
  return router;
}
