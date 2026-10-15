# Restaurant Ordering

A real-time restaurant ordering prototype: configure the menu, order with checkout, and watch
orders change status live.

**Stack:** Nx · Angular 22 (zoneless, signals) · Angular Material/CDK · NgRx SignalStore · Jest ·
Node.js · Express 5 · MongoDB/Mongoose · Zod · ESLint · Prettier

## How to run

Requires Node `^22.22.3` or `^24.15` (`nvm use` reads `.nvmrc`) and Docker.

```bash
npm install
npm start
```

This starts MongoDB (Docker), the API and the web app. An empty database is seeded with 3 000 menu
items.

- App: <http://localhost:4200> (Menu, Orders, Setup)
- API docs (Swagger): <http://localhost:3333/api/docs>

Other commands: `npm run check` (lint + test + build + format), `npm test`, `npm run seed`
(recreate the demo menu). Settings are listed in `.env.example`.

## Key decisions and trade-offs

- **Live updates over SSE, not WebSocket.** The data only flows server → client; SSE reconnects by
  itself and can replay missed events. Trade-off: one direction only. Writes use REST.
- **Menu revision number.** Every menu change bumps a counter and is sent with its event. The client
  applies the next one, ignores duplicates and reloads on a gap, so it stays correct even if
  events are lost. Trade-off: one extra counter in the database.
- **Safe checkout.** The server re-checks the cart (availability, prices, discount) and the user
  must accept any change before confirming. Confirming uses an `Idempotency-Key`, so a double
  click or a retry never creates two orders. Trade-off: one extra request and a second check on
  the server.
- **Whole menu in one response** (3 000 items ≈ 44 KB gzipped) with a virtual-scrolled list. This
  keeps search and live patches instant. Trade-off: it will not scale to tens of thousands of items.
- **Money in integer cents; orders keep a copy of name and price.** No rounding errors, and menu
  edits never change past orders.
- **Shared Zod contracts** (`libs/shared/contracts`) define requests, responses and the API docs
  in one place. Trade-off: Zod is large, so the app only loads it where it is needed (startup JS ≈
  103 KB gzipped).
- **Structure:** feature folders with flat files on the server (`router`, `controller`, `service`,
  `repository`, `entity`) and in the Angular libraries; Nx lint rules keep layers apart.
  State uses small NgRx SignalStores.
- **Speed:** zoneless, `OnPush`, lazy routes, skeletons with the same size as real rows (no layout
  jumps), retry and timeouts for requests, offline and reconnect banner.

More detail: [tech design](docs/tech-design.md) · [UI design](docs/ui-design.md) ·
[realtime protocol](docs/realtime.md) · [database](docs/database.md).

## What I deliberately simplified

- No login or roles: anyone can edit the menu in Setup.
- One currency (USD), one fixed discount per order, no taxes or tips.
- Availability is on/off, there is no stock count.
- The kitchen is simulated: orders move to the next status every 8 seconds.
- Events live in the memory of a single API process.
- MongoDB runs without a replica set, so there are no transactions.
- No end-to-end tests. Pages with long lists are checked by hand in the browser, because the
  virtual list does not render in unit tests. Performance targets are not measured with Lighthouse.

## What production would need

- **Security:** authentication and roles, CORS and CSP, rate limiting, secrets management.
- **Data:** MongoDB replica set with transactions, migrations, backups, expiry for old
  idempotency keys.
- **Live updates for many servers:** Change Streams or a message broker instead of in-memory events.
- **Large menus:** paging by category and server-side search.
- **Operations:** CI/CD and a Docker image for the API, metrics, tracing and central logs, alerts.
- **Quality:** end-to-end and load tests, accessibility audit, Lighthouse checks in CI.
- **Product:** a real kitchen screen, payments, notifications.

## Layout

```
apps/web                    Angular app shell
apps/api                    Express API (folders by feature)
libs/shared/contracts       Zod schemas shared by web and API
libs/web/core, ui           HTTP, errors, live connection, store helpers; shared components
libs/web/*-data-access      Menu and orders stores
libs/web/feature-*          Ordering (catalog, cart, checkout), Orders, Setup
```
