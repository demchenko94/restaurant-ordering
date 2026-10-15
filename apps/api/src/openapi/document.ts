import './extend';
import { OpenApiGeneratorV31, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  ApiError,
  Category,
  CategoryInput,
  CategoryPatch,
  CheckoutQuote,
  CheckoutRequest,
  HealthResponse,
  IDEMPOTENCY_KEY_HEADER,
  Id,
  MenuItem,
  MenuItemInput,
  MenuItemPatch,
  MenuSnapshot,
  Order,
  OrdersPage,
  OrdersQuery,
  OrderStatusPatch,
} from '@restaurant/contracts';
import { z } from 'zod';

const json = <T extends z.ZodType>(schema: T) => ({ content: { 'application/json': { schema } } });
const errorResponse = (description: string) => ({ description, ...json(ApiError) });
const idParam = z.object({ id: Id });

export function buildOpenApiDocument(): ReturnType<OpenApiGeneratorV31['generateDocument']> {
  const registry = new OpenAPIRegistry();

  const refs = {
    Category: registry.register('Category', Category),
    MenuItem: registry.register('MenuItem', MenuItem),
    MenuSnapshot: registry.register('MenuSnapshot', MenuSnapshot),
    CheckoutQuote: registry.register('CheckoutQuote', CheckoutQuote),
    Order: registry.register('Order', Order),
    OrdersPage: registry.register('OrdersPage', OrdersPage),
    ApiError: registry.register('ApiError', ApiError),
  };

  const validation = errorResponse('Validation failed (`VALIDATION_FAILED`)');
  const notFound = errorResponse('Resource not found (`NOT_FOUND`)');

  registry.registerPath({
    method: 'get',
    path: '/api/health',
    tags: ['System'],
    summary: 'Liveness and MongoDB readiness',
    responses: {
      200: { description: 'Healthy', ...json(HealthResponse) },
      503: { description: 'MongoDB is down', ...json(HealthResponse) },
    },
  });

  // ---- menu ---------------------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/menu',
    tags: ['Menu'],
    summary: 'Full menu snapshot',
    description:
      'Returns every category and item plus the current `revision`. Supports `If-None-Match` with the ' +
      '`ETag` (`"rev-<revision>"`); answers `304` when the menu did not change.',
    responses: {
      200: { description: 'Menu snapshot', ...json(refs.MenuSnapshot) },
      304: { description: 'Not modified' },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/categories',
    tags: ['Menu'],
    summary: 'Create a category',
    request: { body: { required: true, ...json(CategoryInput) } },
    responses: {
      201: { description: 'Created', ...json(refs.Category) },
      400: validation,
      409: errorResponse('Name already taken (`DUPLICATE_NAME`)'),
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/categories/{id}',
    tags: ['Menu'],
    summary: 'Rename or reorder a category',
    request: { params: idParam, body: { required: true, ...json(CategoryPatch) } },
    responses: {
      200: { description: 'Updated', ...json(refs.Category) },
      400: validation,
      404: notFound,
      409: errorResponse('Name already taken (`DUPLICATE_NAME`)'),
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/categories/{id}',
    tags: ['Menu'],
    summary: 'Delete an empty category',
    request: { params: idParam },
    responses: {
      204: { description: 'Deleted' },
      404: notFound,
      409: errorResponse('Category still has items (`CATEGORY_NOT_EMPTY`)'),
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/items',
    tags: ['Menu'],
    summary: 'Create a menu item',
    description:
      'Fixed-price items require `priceCents`; set `openPrice: true` (and omit the price) for items ' +
      'whose price is entered when added to an order.',
    request: { body: { required: true, ...json(MenuItemInput) } },
    responses: { 201: { description: 'Created', ...json(refs.MenuItem) }, 400: validation },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/items/{id}',
    tags: ['Menu'],
    summary: 'Update price, availability or other fields',
    description:
      'Switching `openPrice` on clears the price. Switching it off requires `priceCents`. ' +
      'Every change bumps the menu revision and is pushed over SSE.',
    request: { params: idParam, body: { required: true, ...json(MenuItemPatch) } },
    responses: {
      200: { description: 'Updated', ...json(refs.MenuItem) },
      400: validation,
      404: notFound,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/items/{id}',
    tags: ['Menu'],
    summary: 'Delete a menu item',
    description: 'Existing orders keep their snapshot of the item.',
    request: { params: idParam },
    responses: { 204: { description: 'Deleted' }, 404: notFound },
  });

  // ---- checkout & orders --------------------------------------------------
  registry.registerPath({
    method: 'post',
    path: '/api/checkout/quote',
    tags: ['Checkout'],
    summary: 'Validate a cart and compute totals',
    description:
      'Always answers `200`: problems (unavailable, removed, price changed, ...) are returned as data in ' +
      '`changes`. Totals are computed from `lines` that can be ordered right now.',
    request: { body: { required: true, ...json(CheckoutRequest) } },
    responses: { 200: { description: 'Quote', ...json(refs.CheckoutQuote) }, 400: validation },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/orders',
    tags: ['Orders'],
    summary: 'Place an order (idempotent)',
    description:
      `Requires the \`${IDEMPOTENCY_KEY_HEADER}\` header. The same key with the same body returns the ` +
      'original order (`200`, `Idempotency-Replayed: true`) and never creates a second one. ' +
      'The cart is re-validated; any difference answers `409 CART_CHANGED` with the changes in `details`.',
    request: {
      headers: z.object({ [IDEMPOTENCY_KEY_HEADER]: z.string().min(1).max(128) }),
      body: { required: true, ...json(CheckoutRequest) },
    },
    responses: {
      201: { description: 'Order created', ...json(refs.Order) },
      200: { description: 'Replay of an earlier request with the same key', ...json(refs.Order) },
      400: errorResponse(
        'Validation failed or key missing (`VALIDATION_FAILED`, `IDEMPOTENCY_KEY_REQUIRED`)',
      ),
      409: errorResponse('Cart changed (`CART_CHANGED`)'),
      422: errorResponse('Key reused with another body (`IDEMPOTENCY_KEY_REUSED`)'),
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/orders',
    tags: ['Orders'],
    summary: 'List orders, newest first',
    request: { query: OrdersQuery },
    responses: {
      200: { description: 'A page of orders', ...json(refs.OrdersPage) },
      400: validation,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/orders/{id}',
    tags: ['Orders'],
    summary: 'Get one order',
    request: { params: idParam },
    responses: { 200: { description: 'Order', ...json(refs.Order) }, 404: notFound },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/orders/{id}/status',
    tags: ['Orders'],
    summary: 'Move an order to another status',
    description: 'Allowed: placed→preparing→ready→completed, and cancelling before ready.',
    request: { params: idParam, body: { required: true, ...json(OrderStatusPatch) } },
    responses: {
      200: { description: 'Updated order', ...json(refs.Order) },
      404: notFound,
      409: errorResponse('Invalid transition (`INVALID_STATUS_TRANSITION`)'),
    },
  });

  // ---- realtime -----------------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/events',
    tags: ['Realtime'],
    summary: 'Server-Sent Events stream',
    description:
      'Not described by a schema: see `docs/realtime.md`. Event names: `menu.category.upserted`, ' +
      '`menu.category.deleted`, `menu.item.upserted`, `menu.item.deleted`, `order.created`, ' +
      '`order.updated`, `resync`. Reconnect with `Last-Event-ID` to replay missed events.',
    request: { headers: z.object({ 'Last-Event-ID': z.string().optional() }) },
    responses: {
      200: {
        description: 'text/event-stream',
        content: { 'text/event-stream': { schema: z.string() } },
      },
    },
  });

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Restaurant Ordering API',
      version: '1.0.0',
      description:
        'Menu configuration, checkout and orders. Money is in integer cents. ' +
        'All errors use the `ApiError` envelope.',
    },
    servers: [{ url: '/' }],
  });
}
