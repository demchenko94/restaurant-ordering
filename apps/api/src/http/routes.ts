import {
  CategoryInput,
  CategoryPatch,
  CheckoutRequest,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_KEY_PATTERN,
  MenuItemInput,
  MenuItemPatch,
  OrdersQuery,
  OrderStatusPatch,
  type HealthResponse,
} from '@restaurant/contracts';
import { Router } from 'express';
import mongoose from 'mongoose';
import type { EventBus } from '../realtime/event-bus';
import { sseHandler } from '../realtime/sse';
import type { CheckoutService } from '../services/checkout.service';
import type { MenuService } from '../services/menu.service';
import type { OrdersService } from '../services/orders.service';
import { AppError } from './errors';
import { parse, parseId } from './parse';

export interface Services {
  bus: EventBus;
  menu: MenuService;
  checkout: CheckoutService;
  orders: OrdersService;
}

export function createApiRouter({ bus, menu, checkout, orders }: Services): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const up = mongoose.connection.readyState === 1;
    const body: HealthResponse = { status: up ? 'ok' : 'degraded', mongo: up ? 'up' : 'down' };
    res.status(up ? 200 : 503).json(body);
  });

  // ---- menu ---------------------------------------------------------------

  router.get('/menu', async (req, res) => {
    const revision = await menu.getRevision();
    const etag = `"rev-${revision}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache');
    if (req.header('if-none-match') === etag) {
      res.status(304).end();
      return;
    }
    res.json(await menu.getSnapshot());
  });

  router.post('/categories', async (req, res) => {
    res.status(201).json(await menu.createCategory(parse(CategoryInput, req.body)));
  });

  router.patch('/categories/:id', async (req, res) => {
    res.json(await menu.updateCategory(parseId(req.params['id']), parse(CategoryPatch, req.body)));
  });

  router.delete('/categories/:id', async (req, res) => {
    await menu.deleteCategory(parseId(req.params['id']));
    res.status(204).end();
  });

  router.post('/items', async (req, res) => {
    res.status(201).json(await menu.createItem(parse(MenuItemInput, req.body)));
  });

  router.patch('/items/:id', async (req, res) => {
    res.json(await menu.updateItem(parseId(req.params['id']), parse(MenuItemPatch, req.body)));
  });

  router.delete('/items/:id', async (req, res) => {
    await menu.deleteItem(parseId(req.params['id']));
    res.status(204).end();
  });

  // ---- checkout & orders --------------------------------------------------

  router.post('/checkout/quote', async (req, res) => {
    res.json(await checkout.quote(parse(CheckoutRequest, req.body)));
  });

  router.post('/orders', async (req, res) => {
    const key = req.header(IDEMPOTENCY_KEY_HEADER);
    if (!key) {
      throw new AppError(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        `The ${IDEMPOTENCY_KEY_HEADER} header is required`,
      );
    }
    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw AppError.validation(`Invalid ${IDEMPOTENCY_KEY_HEADER} header`, [
        {
          path: ['header', IDEMPOTENCY_KEY_HEADER],
          message: '1-128 chars: letters, digits, _ or -',
        },
      ]);
    }
    const { order, replayed } = await orders.place(key, parse(CheckoutRequest, req.body));
    res.setHeader('Idempotency-Replayed', String(replayed));
    res.status(replayed ? 200 : 201).json(order);
  });

  router.get('/orders', async (req, res) => {
    const { limit, cursor } = parse(OrdersQuery, req.query, 'query');
    res.json(await orders.list(limit, cursor));
  });

  router.get('/orders/:id', async (req, res) => {
    res.json(await orders.get(parseId(req.params['id'])));
  });

  router.patch('/orders/:id/status', async (req, res) => {
    const { status } = parse(OrderStatusPatch, req.body);
    res.json(await orders.transition(parseId(req.params['id']), status));
  });

  // ---- realtime -----------------------------------------------------------

  router.get('/events', sseHandler(bus));

  return router;
}
