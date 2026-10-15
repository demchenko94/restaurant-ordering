import { centsToInput, formatMoney, parseMoneyToCents } from './money.pipe';

describe('money helpers', () => {
  it('formats cents as USD and open price as a dash', () => {
    expect(formatMoney(950)).toBe('$9.50');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(null)).toBe('—');
  });

  it('parses user input to cents', () => {
    expect(parseMoneyToCents('12.5')).toBe(1250);
    expect(parseMoneyToCents('12,50')).toBe(1250);
    expect(parseMoneyToCents(3)).toBe(300);
    expect(parseMoneyToCents('0.07')).toBe(7);
  });

  it('rejects malformed amounts', () => {
    for (const bad of ['', 'abc', '1.234', '-1', '1e3', null, undefined]) {
      expect(parseMoneyToCents(bad)).toBeNull();
    }
  });

  it('formats cents for an input field', () => {
    expect(centsToInput(1250)).toBe('12.50');
    expect(centsToInput(null)).toBe('');
  });
});
