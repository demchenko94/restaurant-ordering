import { Pipe, type PipeTransform } from '@angular/core';

const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Formats integer cents as currency. `null` (open price) renders as an em dash. */
export function formatMoney(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '—' : formatter.format(cents / 100);
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(cents: number | null | undefined): string {
    return formatMoney(cents);
  }
}

/** Parses user input like "12.5" or "12,50" into cents; `null` when it is not a valid amount. */
export function parseMoneyToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === '') return null;
  const normalized = String(input).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export function centsToInput(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);
}
