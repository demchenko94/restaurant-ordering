/** Sum of `unitPriceCents * quantity`. All values are integer cents. */
export function lineTotal(unitPriceCents: number, quantity: number): number {
  return unitPriceCents * quantity;
}
