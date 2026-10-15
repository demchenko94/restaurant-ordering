import { canTransition, ORDER_STATUS_TRANSITIONS, OrderStatus } from './orders';

describe('order status transitions', () => {
  it('allows the happy path', () => {
    expect(canTransition('placed', 'preparing')).toBe(true);
    expect(canTransition('preparing', 'ready')).toBe(true);
    expect(canTransition('ready', 'completed')).toBe(true);
  });

  it('allows cancelling before the order is ready', () => {
    expect(canTransition('placed', 'cancelled')).toBe(true);
    expect(canTransition('preparing', 'cancelled')).toBe(true);
    expect(canTransition('ready', 'cancelled')).toBe(false);
  });

  it('never leaves a terminal status or goes backwards', () => {
    expect(canTransition('completed', 'placed')).toBe(false);
    expect(canTransition('cancelled', 'placed')).toBe(false);
    expect(canTransition('ready', 'preparing')).toBe(false);
  });

  it('defines transitions for every status', () => {
    const statuses = Object.keys(ORDER_STATUS_TRANSITIONS) as OrderStatus[];
    expect(statuses.sort()).toEqual(
      ['cancelled', 'completed', 'placed', 'preparing', 'ready'].sort(),
    );
  });
});
