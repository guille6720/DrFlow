/** ARS currency for dashboards and admin analytics (no decimals). */
export function formatCurrencyAr(amount: number): string {
  return `$${amount.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/** ARS currency with Intl (used in payments UI). */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);
}
