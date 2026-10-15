import { SERVER_EVENT_TYPES } from './event-types';
import { ServerEvent } from './events';

describe('ServerEvent', () => {
  it('parses a menu item deletion', () => {
    const event = ServerEvent.parse({ type: 'menu.item.deleted', revision: 4, id: 'c'.repeat(24) });
    expect(event.type).toBe('menu.item.deleted');
  });

  it('parses resync without payload', () => {
    expect(ServerEvent.safeParse({ type: 'resync' }).success).toBe(true);
  });

  it('rejects unknown types and invalid payloads', () => {
    expect(ServerEvent.safeParse({ type: 'nope' }).success).toBe(false);
    expect(ServerEvent.safeParse({ type: 'menu.item.deleted', revision: 1, id: 'x' }).success).toBe(
      false,
    );
  });

  it('lists the same event names as the schema', () => {
    const fromSchema = ServerEvent.options.map((o) => o.shape.type.value).sort();
    expect([...SERVER_EVENT_TYPES].sort()).toEqual(fromSchema);
  });
});
