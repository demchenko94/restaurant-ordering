import { Router } from 'express';
import { CheckoutController } from './checkout.controller';
import type { CheckoutService } from './checkout.service';

export function createCheckoutRouter(service: CheckoutService): Router {
  const controller = new CheckoutController(service);
  const router = Router();
  router.post('/checkout/quote', controller.quote);
  return router;
}
