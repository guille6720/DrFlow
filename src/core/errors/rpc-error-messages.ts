/** Machine-readable RPC / application error codes raised from PostgreSQL. */
export const RPC_ERROR_CODES = {
  ALREADY_HAS_CLINIC: "ALREADY_HAS_CLINIC",
  ALREADY_VOIDED: "ALREADY_VOIDED",
  APPOINTMENT_NOT_FOUND: "APPOINTMENT_NOT_FOUND",
  APPOINTMENT_SLOT_CONFLICT: "APPOINTMENT_SLOT_CONFLICT",
  BOOKING_SLOT_IN_PAST: "BOOKING_SLOT_IN_PAST",
  BOOKING_SLOT_UNAVAILABLE: "BOOKING_SLOT_UNAVAILABLE",
  CAJA_MODULE_NOT_INSTALLED: "CAJA_MODULE_NOT_INSTALLED",
  CHARGE_NOT_FOUND: "CHARGE_NOT_FOUND",
  CLINIC_ID_REQUIRED: "CLINIC_ID_REQUIRED",
  CLINIC_NOT_FOUND: "CLINIC_NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  INVALID_BOOKING_SLUG: "INVALID_BOOKING_SLUG",
  INVALID_PROFESSIONAL_FOR_CLINIC: "INVALID_PROFESSIONAL_FOR_CLINIC",
  LICENSE_REQUIRED: "LICENSE_REQUIRED",
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  NOT_MEMBER: "NOT_MEMBER",
  PATIENT_NOT_FOUND: "PATIENT_NOT_FOUND",
  PHONE_REQUIRED: "PHONE_REQUIRED",
  REASON_REQUIRED: "REASON_REQUIRED",
  RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
  SLUG_TAKEN: "SLUG_TAKEN",
  TEMPLATE_NOT_FOUND: "TEMPLATE_NOT_FOUND",
} as const;

export type RpcErrorCode = (typeof RPC_ERROR_CODES)[keyof typeof RPC_ERROR_CODES];

/** Default user-facing messages keyed by RPC code. */
export const RPC_USER_MESSAGES: Record<RpcErrorCode, string> = {
  ALREADY_HAS_CLINIC: "Ya tenés una clínica configurada.",
  ALREADY_VOIDED: "El cobro ya está anulado.",
  APPOINTMENT_NOT_FOUND: "Turno no encontrado.",
  APPOINTMENT_SLOT_CONFLICT: "El profesional ya tiene un turno en ese horario.",
  BOOKING_SLOT_IN_PAST: "El horario seleccionado ya pasó.",
  BOOKING_SLOT_UNAVAILABLE: "Ese horario ya no está disponible. Elegí otro.",
  CAJA_MODULE_NOT_INSTALLED: "El módulo de caja no está instalado. Aplicá la migración 034.",
  CHARGE_NOT_FOUND: "Cobro no encontrado.",
  CLINIC_ID_REQUIRED: "La clínica es obligatoria.",
  CLINIC_NOT_FOUND: "La clínica activa no existe.",
  FORBIDDEN: "No tenés permiso para realizar esta acción.",
  INVALID_BOOKING_SLUG: "El link de reserva no es válido.",
  INVALID_PROFESSIONAL_FOR_CLINIC: "Profesional no válido para esta clínica.",
  LICENSE_REQUIRED: "La matrícula es obligatoria.",
  NOT_AUTHENTICATED: "Tenés que iniciar sesión.",
  NOT_MEMBER: "No sos miembro de esta clínica.",
  PATIENT_NOT_FOUND: "Paciente no encontrado.",
  PHONE_REQUIRED: "El teléfono es obligatorio.",
  REASON_REQUIRED: "Indicá el motivo de la cancelación.",
  RECORD_NOT_FOUND: "Consulta no encontrada.",
  SLUG_TAKEN: "Ese identificador URL ya está en uso.",
  TEMPLATE_NOT_FOUND: "Plantilla no encontrada.",
};

export function isKnownRpcErrorCode(value: string | undefined): value is RpcErrorCode {
  return !!value && value in RPC_USER_MESSAGES;
}
