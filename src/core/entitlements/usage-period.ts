/** UTC calendar month start, matching feature_usage_period_start(). */
export function featureUsagePeriodStart(at: Date = new Date()): string {
  const year = at.getUTCFullYear();
  const month = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function isPositiveUsageAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0;
}
