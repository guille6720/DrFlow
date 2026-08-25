import { z } from "zod";

/** Límite histórico alineado con `sanitizeText` — no reducir para no bloquear ediciones. */
export const CLINICAL_TEXT_MAX = 10_000;

/** Rechaza payloads crudos inflados antes de normalizar (DoS / campos enormes). */
export const CLINICAL_TEXT_RAW_MAX = 12_000;

export const MEDICAL_ORDER_TEXT_MAX = CLINICAL_TEXT_MAX;
export const MEDICAL_ORDER_NOTES_MAX = CLINICAL_TEXT_MAX;

export const PRESCRIPTION_DIAGNOSIS_TEXT_MAX = 2_000;
export const PRESCRIPTION_DIAGNOSIS_CIE10_MAX = 32;
export const PRESCRIPTION_NOTES_MAX = CLINICAL_TEXT_MAX;
export const PRESCRIPTION_MEDICATION_NAME_MAX = 300;
export const PRESCRIPTION_POSOLOGY_MAX = 1_000;
export const PRESCRIPTION_MEDICATIONS_JSON_MAX = 50_000;

const HTML_TAG = /<[^>]+>/;
const SCRIPT_TAG = /<\s*script\b/i;
const STYLE_TAG = /<\s*style\b/i;
const JS_URI = /javascript\s*:/i;
const DATA_HTML_URI = /data\s*:\s*text\/html/i;
const EVENT_HANDLER = /\bon[a-z]+\s*=/i;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const BIDI_AND_INVISIBLE = /[\u202A-\u202E\u2066-\u2069\u200E\u200F\u200B-\u200D\uFEFF]/;
const NULL_BYTE = /\0/;

export type ClinicalTextValidationOptions = {
  fieldLabel: string;
  maxLength: number;
  required?: boolean;
  maxRawLength?: number;
};

export function getClinicalTextValidationError(
  raw: string,
  options: ClinicalTextValidationOptions
): string | null {
  const {
    fieldLabel,
    maxLength,
    required = false,
    maxRawLength = CLINICAL_TEXT_RAW_MAX,
  } = options;

  if (raw.length > maxRawLength) {
    return `${fieldLabel} es demasiado largo. Máximo ${maxLength} caracteres.`;
  }

  if (NULL_BYTE.test(raw)) {
    return `${fieldLabel} contiene caracteres no permitidos.`;
  }

  if (CONTROL_CHARS.test(raw)) {
    return `${fieldLabel} contiene caracteres de control no permitidos.`;
  }

  if (BIDI_AND_INVISIBLE.test(raw)) {
    return `${fieldLabel} contiene caracteres Unicode invisibles o de control no permitidos.`;
  }

  if (SCRIPT_TAG.test(raw) || STYLE_TAG.test(raw) || HTML_TAG.test(raw)) {
    return `${fieldLabel} no puede contener HTML.`;
  }

  if (JS_URI.test(raw) || DATA_HTML_URI.test(raw) || EVENT_HANDLER.test(raw)) {
    return `${fieldLabel} no puede contener JavaScript ni enlaces peligrosos.`;
  }

  const trimmed = raw.trim();

  if (required && trimmed.length === 0) {
    return raw.length === 0
      ? `${fieldLabel}: campo obligatorio.`
      : `${fieldLabel}: no puede contener solo espacios.`;
  }

  if (trimmed.length > maxLength) {
    return `${fieldLabel} no puede superar ${maxLength} caracteres.`;
  }

  return null;
}

/** Refinamiento Zod reutilizable para campos de texto clínico obligatorios. */
export function requiredClinicalTextRefinement(options: ClinicalTextValidationOptions) {
  return (value: string, ctx: z.RefinementCtx) => {
    const error = getClinicalTextValidationError(value, { ...options, required: true });
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }
  };
}

/** Refinamiento Zod para campos opcionales (null / vacío permitido). */
export function optionalClinicalTextRefinement(options: ClinicalTextValidationOptions) {
  return (value: string | null | undefined, ctx: z.RefinementCtx) => {
    if (value == null || value === "") return;
    const error = getClinicalTextValidationError(value, { ...options, required: false });
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }
  };
}

export const MEDICAL_ORDER_TYPES = ["study", "referral", "pami_form"] as const;

export type MedicalOrderType = (typeof MEDICAL_ORDER_TYPES)[number];
