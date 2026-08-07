/**
 * Mirrors `api/src/utils/money.ts`. The editor shows a total before the API
 * ever sees the invoice, so both sides have to round the same way — otherwise
 * the figure on screen and the one stored differ by a cent.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;

  const scaled = value * 100;
  return Math.round(scaled + Math.sign(scaled) * 1e-9) / 100;
}

export function lineAmount(hours: number, rate: number): number {
  return roundMoney((hours || 0) * (rate || 0));
}

/** Sums the rounded lines: the total must equal what the rows add up to. */
export function sumLineAmounts(items: readonly { hours: number; rate: number }[]): number {
  return roundMoney(items.reduce((sum, item) => sum + lineAmount(item.hours, item.rate), 0));
}
