/** Catálogos y etiquetas del módulo Caja (sin opción PLUS). */

export const CASH_ATTENTION_TYPES = [
  { value: "particular", label: "Particular" },
  { value: "obra_social", label: "Obra Social" },
  { value: "prepaga", label: "Prepaga" },
  { value: "art", label: "ART" },
  { value: "sin_cargo", label: "Sin Cargo" },
] as const;

export const CASH_CHARGE_KINDS = [
  { value: "consulta_particular", label: "Consulta Particular" },
  { value: "copago_autorizado", label: "Copago autorizado" },
  { value: "coseguro_autorizado", label: "Coseguro autorizado" },
  { value: "practica", label: "Práctica" },
  { value: "certificado_medico", label: "Certificado Médico" },
  { value: "apto_fisico", label: "Apto Físico" },
  { value: "vacunacion", label: "Vacunación" },
  { value: "control", label: "Control" },
  { value: "procedimiento", label: "Procedimiento" },
  { value: "otro", label: "Otro" },
] as const;

export const CASH_CHARGE_STATUSES = [
  { value: "pending", label: "Pendiente", variant: "warning" as const },
  { value: "collected", label: "Cobrado", variant: "success" as const },
  { value: "voided", label: "Anulado", variant: "danger" as const },
  { value: "refunded", label: "Devuelto", variant: "default" as const },
] as const;

export const CASH_PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "debit", label: "Débito" },
  { value: "credit", label: "Crédito" },
  { value: "transfer", label: "Transferencia" },
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "qr", label: "QR" },
  { value: "account", label: "Cuenta Corriente" },
] as const;

export const WAITING_ROOM_STATUSES = [
  { value: "waiting", label: "Esperando", color: "slate" },
  { value: "confirmed", label: "Confirmado", color: "blue" },
  { value: "in_consultation", label: "En consultorio", color: "teal" },
  { value: "finished", label: "Finalizado", color: "green" },
  { value: "cancelled", label: "Cancelado", color: "red" },
  { value: "absent", label: "Ausente", color: "amber" },
] as const;

export const ADMIN_DOCUMENT_CATEGORIES = [
  { value: "authorization", label: "Autorización" },
  { value: "medical_order", label: "Orden médica" },
  { value: "patient_study", label: "Estudio del paciente" },
  { value: "general", label: "General" },
  { value: "other", label: "Otro" },
] as const;

export type CashAttentionType = (typeof CASH_ATTENTION_TYPES)[number]["value"];
export type CashChargeKind = (typeof CASH_CHARGE_KINDS)[number]["value"];
export type CashChargeStatus = (typeof CASH_CHARGE_STATUSES)[number]["value"];
export type CashPaymentMethod = (typeof CASH_PAYMENT_METHODS)[number]["value"];
export type WaitingRoomStatus = (typeof WAITING_ROOM_STATUSES)[number]["value"];

export function labelForChargeKind(code: string): string {
  return CASH_CHARGE_KINDS.find((c) => c.value === code)?.label ?? code;
}

export function labelForPaymentMethod(code: string): string {
  return CASH_PAYMENT_METHODS.find((m) => m.value === code)?.label ?? code;
}

export function labelForAttentionType(code: string): string {
  return CASH_ATTENTION_TYPES.find((a) => a.value === code)?.label ?? code;
}

export function labelForWaitingRoom(code: string): string {
  return WAITING_ROOM_STATUSES.find((s) => s.value === code)?.label ?? code;
}

/** Cobros no autorizados explícitamente bloqueados */
export const BLOCKED_CHARGE_LABELS = ["plus", "PLUS", "Plus"];

export function isBlockedChargeKind(label: string): boolean {
  const n = label.trim().toLowerCase();
  return n === "plus";
}
