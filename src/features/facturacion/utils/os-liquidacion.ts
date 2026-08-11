export type OsLiquidationStatus = "draft" | "submitted" | "paid" | "cancelled";
export type OsBillableStatus = "pending" | "in_batch" | "submitted" | "paid" | "rejected";

export type OsLiquidationBatchRow = {
  id: string;
  insurance_provider: string;
  period_from: string;
  period_to: string;
  status: OsLiquidationStatus;
  total_amount: number;
  item_count: number;
  submitted_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

export type OsBillableItemRow = {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  professional_id: string | null;
  insurance_provider: string;
  insurance_number: string | null;
  insurance_plan: string | null;
  practice_code: string;
  practice_label: string;
  amount: number;
  copago_collected: number;
  status: OsBillableStatus;
  attended_at: string;
  patient_name?: string;
  professional_name?: string;
};

export type OsPendingSummaryRow = {
  insurance_provider: string;
  pending_count: number;
  pending_amount: number;
};

export type OsFeeScheduleRow = {
  id: string;
  insurance_provider: string;
  practice_code: string;
  practice_label: string;
  amount: number;
  is_active: boolean;
};

const STATUS_LABELS: Record<OsLiquidationStatus, string> = {
  draft: "Borrador",
  submitted: "Presentado",
  paid: "Acreditado",
  cancelled: "Anulado",
};

const BILLABLE_STATUS_LABELS: Record<OsBillableStatus, string> = {
  pending: "Pendiente",
  in_batch: "En lote",
  submitted: "Presentado",
  paid: "Acreditado",
  rejected: "Rechazado",
};

export function labelOsLiquidationStatus(status: OsLiquidationStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function labelOsBillableStatus(status: OsBillableStatus): string {
  return BILLABLE_STATUS_LABELS[status] ?? status;
}

export function formatOsAmount(amount: number): string {
  return `$${amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function buildOsLiquidationCsv(items: OsBillableItemRow[]): string {
  const header = [
    "fecha_atencion",
    "obra_social",
    "afiliado",
    "plan",
    "codigo_practica",
    "practica",
    "importe",
    "copago_cobrado",
    "neto",
    "paciente",
    "profesional",
    "estado",
  ].join(",");

  const rows = items.map((item) => {
    const net = Math.max(0, item.amount - item.copago_collected);
    return [
      item.attended_at.slice(0, 10),
      csvEscape(item.insurance_provider),
      csvEscape(item.insurance_number ?? ""),
      csvEscape(item.insurance_plan ?? ""),
      item.practice_code,
      csvEscape(item.practice_label),
      item.amount.toFixed(2),
      item.copago_collected.toFixed(2),
      net.toFixed(2),
      csvEscape(item.patient_name ?? ""),
      csvEscape(item.professional_name ?? ""),
      item.status,
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function isOsLiquidationActionable(status: OsLiquidationStatus): boolean {
  return status === "draft" || status === "submitted";
}
