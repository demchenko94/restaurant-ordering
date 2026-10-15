import { Router } from 'express';
import { HealthController } from './health.controller';

export function createHealthRouter(): Router {
  const controller = new HealthController();
  const router = Router();
  router.get('/health', controller.get);
  return router;
}
