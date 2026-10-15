import { Router } from 'express';
import { EventsController } from './events.controller';
import type { EventBus } from './event-bus';

export function createEventsRouter(bus: EventBus): Router {
  const controller = new EventsController(bus);
  const router = Router();
  router.get('/events', controller.stream);
  return router;
}
