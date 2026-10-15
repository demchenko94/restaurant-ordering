# Realtime protocol (SSE)

Endpoint: `GET /api/events` → `text/event-stream`. One-directional (server → client). All writes
go through the REST API; the stream only reports what happened.

Payload shapes are the `ServerEvent` Zod union in `libs/shared/contracts/src/lib/events.ts`.

## Events

| `event:` name            | Payload                        | Sent when                                          |
| ------------------------ | ------------------------------ | -------------------------------------------------- |
| `menu.category.upserted` | `{ type, revision, category }` | category created or changed                        |
| `menu.category.deleted`  | `{ type, revision, id }`       | category deleted                                   |
| `menu.item.upserted`     | `{ type, revision, item }`     | item created, price or availability changed, moved |
| `menu.item.deleted`      | `{ type, revision, id }`       | item deleted                                       |
| `order.created`          | `{ type, order }`              | order placed                                       |
| `order.updated`          | `{ type, order }`              | order status changed (manual or simulator)         |
| `resync`                 | `{ type }`                     | server cannot replay what the client missed        |

`data:` is always the JSON of the whole event (including `type`), so a client can parse every
frame with `ServerEvent.parse` without looking at the `event:` line.

Example frame:

```
id: mv9db1iq-12
event: menu.item.upserted
data: {"type":"menu.item.upserted","revision":42,"item":{"id":"…","name":"Margherita","available":false,…}}

```

Availability and price changes are plain `menu.item.upserted` events; there are no special types.

## Event ids and replay

- `id` is `<epoch>-<seq>`. `epoch` is fixed per server start, `seq` increases by one per event.
- The server keeps the last `EVENT_BUFFER_SIZE` (default 500) events in memory.
- A reconnecting `EventSource` sends `Last-Event-ID`. The server then:
  - replays every event after that id, if they are all still in the buffer;
  - sends nothing extra if the client is up to date;
  - sends a single `resync` event if the id belongs to another epoch (server restarted), is
    unknown, or fell out of the buffer.
- On `resync` the client must reload `GET /api/menu` and the first page of `GET /api/orders`.
- The server sets `retry: 3000` (ms) for the browser's automatic reconnect.
- A `: heartbeat` comment is sent every 20 s so proxies do not close an idle connection.

## Menu revision (client consistency rule)

Every menu event carries `revision`, the value of the `menuRevision` counter after the change.
`GET /api/menu` returns the revision of its snapshot (and `ETag: "rev-<revision>"`).

For a client holding revision `R` and receiving a menu event with revision `E`:

| Condition  | Action                                     |
| ---------- | ------------------------------------------ |
| `E == R+1` | apply, `R = E`                             |
| `E <= R`   | ignore (duplicate, or already in snapshot) |
| `E > R+1`  | gap → reload `GET /api/menu`               |

This makes the client correct even if the replay buffer logic is wrong or events arrive twice.
Order events have no revision; they are upserted by order id.

## Ordering guarantees

- Menu mutations are serialized inside the API process (write → bump revision → publish), so
  revisions are published in order.
- Events are published after the database write succeeded, so an event never announces a change
  that did not happen. A crash between the write and the publish loses the event, which the
  revision rule detects on the next event or reconnect.

## Limits and production notes

- The bus and its buffer are in-process: it works for a single API instance. For several
  instances use MongoDB Change Streams (needs a replica set) or a broker such as Redis Pub/Sub or
  NATS, and persist event ids.
- Compression is disabled for this route, otherwise frames would be buffered.
- Behind a reverse proxy disable response buffering (`X-Accel-Buffering: no` is already sent).
