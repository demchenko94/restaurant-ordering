# Restaurant Ordering

Real-time restaurant ordering prototype: menu setup, ordering with checkout, live orders list.

Stack: Nx · Angular 22 (zoneless, signals) · Angular Material/CDK · NgRx SignalStore · Jest ·
Node.js · Express 5 · MongoDB/Mongoose · Zod · ESLint · Prettier.

## Requirements

- Node `^22.22.3` or `^24.15` (see `.nvmrc`; Angular 22 does not run on older Node)
- Docker (for MongoDB)

## Run

```bash
npm install
npm start
```

`npm start` brings up MongoDB via Docker Compose, then serves the API (`http://localhost:3333`)
and the web app (`http://localhost:4200`, `/api` is proxied to the API).

## Scripts

| Command              | What it does                     |
| -------------------- | -------------------------------- |
| `npm run lint`       | ESLint for all projects          |
| `npm test`           | Jest for all projects            |
| `npm run build`      | Production build of all projects |
| `npm run check`      | lint + test + build + format     |
| `npm run db:up/down` | Start / stop MongoDB             |

## API

- Swagger UI: <http://localhost:3333/api/docs>, spec: `/api/openapi.json` (generated from the Zod
  contracts).
- Health: `GET /api/health`.
- On first start an empty database is seeded with 12 categories and 3 000 items (see
  `.env.example` for all settings).
- Orders advance automatically (`placed → preparing → ready → completed`, one step every 8 s,
  `SIMULATOR_STEP_MS`); `PATCH /api/orders/:id/status` does it manually.

Design and protocol documents:

- [docs/tech-design.md](docs/tech-design.md) – contracts, data model, requests, checkout flow
- [docs/ui-design.md](docs/ui-design.md) – Angular app design
- [docs/realtime.md](docs/realtime.md) – SSE events, replay, revision rule
- [docs/database.md](docs/database.md) – collections, indexes, invariants

## Web app

Screens: **Menu** (`/menu`: virtual-scrolled catalog, search, categories, cart, checkout),
**Orders** (`/orders`: live statuses) and **Setup** (`/setup`: categories, items, prices,
availability, open-price flag). Anything changed in Setup, or by another browser tab, shows up in
the Menu immediately over SSE, including prices and availability of items already in the cart.

Checkout is a small state machine (`CheckoutStore`): the cart is re-validated by the server, any
change (unavailable item, new price, discount too high) is shown and must be accepted before the
order can be confirmed, and confirming is idempotent, so a double click or a retry after a lost
connection can never create two orders. See [docs/ui-design.md](docs/ui-design.md).

## Workspace layout

```
apps/web                       Angular application shell (routes, theme, realtime wiring)
apps/api                       Express API, flat structure by feature (see docs/tech-design.md §9)
libs/shared/contracts          Zod schemas + DTO types shared by web and api
libs/web/core                  HTTP resilience, errors, SSE client, connection state, reusable store features
libs/web/ui                    Presentational components and helpers
libs/web/menu-data-access      Menu API + MenuStore (NgRx SignalStore)
libs/web/orders-data-access    Orders API + OrdersStore
libs/web/feature-ordering      catalog/ cart/ checkout/  (flat files per sub-feature)
libs/web/feature-orders        Orders list
libs/web/feature-setup         categories/ items/  (menu configuration)
docs/                 Assignment and (later) API / database documentation
```

> Key decisions, simplifications and production-readiness notes: _to be filled in as the
> implementation progresses._
