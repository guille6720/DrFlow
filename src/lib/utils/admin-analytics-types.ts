import { formatCurrencyAr } from "@/shared/utils/currency";

/** Revenue and authorization analytics snapshot for Phase H. */

export type AdminAnalyticsBreakdownRow = {
  code: string;
  label: string;
  amount: number;
};

export type AdminAuthorizationDocRow = {
  title: string;
  patientName: string;
  createdAt: string;
};

/** Rule-based analytics context — sourced from cash_charges + admin docs. */
export type AdminAnalyticsSnapshot = {
  dateLabel: string;
  todayTotal: number;
  todayChargeCount: number;
  monthTotal: number;
  monthChargeCount: number;
  copagoTotal: number;
  coseguroTotal: number;
  closureClosedToday: boolean;
  paymentBreakdown: AdminAnalyticsBreakdownRow[];
  chargeKindBreakdown: AdminAnalyticsBreakdownRow[];
  attentionBreakdown: AdminAnalyticsBreakdownRow[];
  authorizationCount: number;
  recentAuthorizations: AdminAuthorizationDocRow[];
};

/** @deprecated Use formatCurrencyAr from @/shared/utils/currency */
export { formatCurrencyAr };

export function formatBreakdownLines(rows: AdminAnalyticsBreakdownRow[]): string {
  if (rows.length === 0) return "Sin datos en el período.";
  return rows
    .filter((r) => r.amount > 0)
    .map((r) => `• ${r.label}: ${formatCurrencyAr(r.amount)}`)
    .join("\n");
}
