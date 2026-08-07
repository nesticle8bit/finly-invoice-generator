/**
 * Totals are stored as DECIMAL(10,2). Anything computed with JS floats has to
 * be snapped back to cents, or the stored total drifts from the sum of the
 * printed line amounts (0.1 + 0.2 territory).
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;

  const scaled = value * 100;
  // Nudge by well under half a cent before rounding: 8.325 is held as
  // 8.32499999… and would otherwise round down to 8.32.
  return Math.round(scaled + Math.sign(scaled) * 1e-9) / 100;
}

export function lineAmount(hours: number, rate: number): number {
  return roundMoney(hours * rate);
}

/**
 * Sums the *rounded* lines rather than the raw products: the total has to match
 * what a reader gets by adding up the amounts printed on the invoice.
 */
export function sumLineAmounts(items: ReadonlyArray<{ hours: number; rate: number }>): number {
  return roundMoney(items.reduce((sum, item) => sum + lineAmount(item.hours, item.rate), 0));
}
