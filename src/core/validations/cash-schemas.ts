import { z } from "zod";

const cashChargeKind = z.enum([
  "consulta_particular",
  "copago_autorizado",
  "coseguro_autorizado",
  "practica",
  "certificado_medico",
  "apto_fisico",
  "vacunacion",
  "control",
  "procedimiento",
  "otro",
]);

const cashAttentionType = z.enum([
  "particular",
  "obra_social",
  "prepaga",
  "art",
  "sin_cargo",
]);

const cashPaymentMethod = z.enum([
  "cash",
  "debit",
  "credit",
  "transfer",
  "mercadopago",
  "qr",
  "account",
]);

export const createCashChargeSchema = z.object({
  patient_id: z.string().uuid("Seleccioná un paciente"),
  professional_id: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  appointment_id: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  charge_kind: cashChargeKind,
  attention_type: cashAttentionType.default("particular"),
  payment_method: cashPaymentMethod.default("cash"),
  motive: z.string().max(500).optional(),
  amount: z.coerce.number().positive("El importe debe ser mayor a 0"),
  notes: z.string().max(1000).optional(),
  status: z.enum(["pending", "collected"]).default("collected"),
});

export const voidCashChargeSchema = z.object({
  charge_id: z.string().uuid(),
  reason: z.string().min(3, "Indicá el motivo de anulación").max(500),
});

export const waitingRoomStatusSchema = z.enum([
  "waiting",
  "confirmed",
  "in_consultation",
  "finished",
  "cancelled",
  "absent",
]);

export const patientAdminSchema = z.object({
  first_name: z.string().min(1, "Nombre requerido"),
  last_name: z.string().min(1, "Apellido requerido"),
  document_number: z.string().min(6, "DNI inválido"),
  document_type: z.preprocess(
    (v) => (v === "" || v == null ? "dni" : v),
    z.enum(["dni", "passport", "cuit", "cdi", "other"])
  ),
  cuil: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().nullable().optional()),
  alt_identifier_type: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(["cuit", "cdi", "passport", "other"]).nullable().optional()
  ),
  alt_identifier_value: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().nullable().optional()
  ),
  birth_date: z.string().optional(),
  sex: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(["F", "M", "X"]).nullable().optional()
  ),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional(),
  insurance_provider: z.string().optional(),
  insurance_plan: z.string().max(120).optional().nullable(),
  insurance_number: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
});

export const ledgerEntrySchema = z.object({
  patient_id: z.string().uuid(),
  professional_id: z.string().uuid().optional().nullable(),
  concept: z.string().min(2).max(300),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
  notes: z.string().max(500).optional(),
});

export const cashClosureSchema = z.object({
  closure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cash_difference: z.coerce.number().default(0),
  notes: z.string().max(1000).optional(),
});

export const cashReportFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  professional_id: z.string().uuid().optional(),
  patient_id: z.string().uuid().optional(),
  payment_method: cashPaymentMethod.optional(),
  attention_type: cashAttentionType.optional(),
  charge_kind: cashChargeKind.optional(),
});

export const mockPaymentSchema = z.object({
  patient_id: z.string().uuid("Paciente inválido"),
  appointment_id: z.string().uuid().optional(),
  amount: z.coerce.number().positive("Importe inválido").max(999_999_999),
  deposit_amount: z.coerce.number().min(0).max(999_999_999).default(0),
});
