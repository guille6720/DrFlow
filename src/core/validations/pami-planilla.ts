import { z } from "zod";

import {
  CLINICAL_TEXT_RAW_MAX,
  getClinicalTextValidationError,
  MEDICAL_ORDER_TEXT_MAX,
  optionalClinicalTextRefinement,
} from "@/core/validations/clinical-free-text";

import type { PamiPlanillaTemplate } from "@/lib/constants/pami-planillas";
import { pamiValidationMessages } from "@/locales/es-AR/pami/validation";

/** Campo de una sola línea (CIE-10, cuidador, etc.). */
export const PAMI_PLANILLA_FIELD_SINGLE_MAX = 500;

/** Campos multilínea (motivo, plan, evolución). */
export const PAMI_PLANILLA_FIELD_MULTILINE_MAX = 2_000;

/** Límite crudo por campo antes de normalizar (anti-DoS en pegado masivo). */
export const PAMI_PLANILLA_FIELD_RAW_MAX = 2_500;

/** Documento renderizado — alineado con medical_orders.order_text. */
export const PAMI_PLANILLA_RENDERED_MAX = MEDICAL_ORDER_TEXT_MAX;

/** Suma JSON de todos los valores del formulario. */
export const PAMI_PLANILLA_VALUES_PAYLOAD_MAX = 6_500;

export function getPamiPlanillaFieldMaxLength(multiline?: boolean): number {
  return multiline ? PAMI_PLANILLA_FIELD_MULTILINE_MAX : PAMI_PLANILLA_FIELD_SINGLE_MAX;
}

export function clampPamiPlanillaFieldValue(value: string, multiline?: boolean): string {
  return value.slice(0, getPamiPlanillaFieldMaxLength(multiline));
}

/** Recorta valores a límites por campo — evita crecimiento indefinido mientras se escribe. */
export function clampPamiPlanillaValues(
  template: PamiPlanillaTemplate,
  values: Record<string, string>
): Record<string, string> {
  const clamped: Record<string, string> = { ...values };
  for (const field of template.fields) {
    if (field.key in clamped) {
      clamped[field.key] = clampPamiPlanillaFieldValue(
        clamped[field.key] ?? "",
        field.multiline
      );
    }
  }
  return clamped;
}

export function buildPamiPlanillaValuesSchema(template: PamiPlanillaTemplate) {
  const shape: Record<string, z.ZodString> = {};

  for (const field of template.fields) {
    const maxLength = getPamiPlanillaFieldMaxLength(field.multiline);
    shape[field.key] = z
      .string()
      .max(maxLength, pamiValidationMessages.fieldMaxLength(field.label, maxLength))
      .superRefine(
        optionalClinicalTextRefinement({
          fieldLabel: field.label,
          maxLength,
          maxRawLength: Math.min(PAMI_PLANILLA_FIELD_RAW_MAX, CLINICAL_TEXT_RAW_MAX),
        })
      );
  }

  return z.object(shape).superRefine((data, ctx) => {
    const payload = JSON.stringify(data);
    if (payload.length > PAMI_PLANILLA_VALUES_PAYLOAD_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: pamiValidationMessages.payloadTooLarge(PAMI_PLANILLA_VALUES_PAYLOAD_MAX),
      });
    }
  });
}

export type PamiPlanillaValues = Record<string, string>;

export function pickPamiPlanillaValues(
  template: PamiPlanillaTemplate,
  values: Record<string, string>
): PamiPlanillaValues {
  const picked: PamiPlanillaValues = {};
  for (const field of template.fields) {
    picked[field.key] = values[field.key] ?? "";
  }
  return picked;
}

export function parsePamiPlanillaValues(
  template: PamiPlanillaTemplate,
  values: Record<string, string>
): { ok: true; data: PamiPlanillaValues } | { ok: false; error: string } {
  const schema = buildPamiPlanillaValuesSchema(template);
  const parsed = schema.safeParse(pickPamiPlanillaValues(template, values));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? pamiValidationMessages.invalidData };
  }
  return { ok: true, data: parsed.data };
}

export function validatePamiPlanillaHasUserContent(
  template: PamiPlanillaTemplate,
  values: Record<string, string>
): string | null {
  const hasContent = template.fields.some((field) => (values[field.key] ?? "").trim().length > 0);
  if (!hasContent) {
    return pamiValidationMessages.emptyField;
  }
  return null;
}

export function validatePamiPlanillaRendered(rendered: string): string | null {
  return getClinicalTextValidationError(rendered, {
    fieldLabel: pamiValidationMessages.renderedFieldLabel,
    maxLength: PAMI_PLANILLA_RENDERED_MAX,
    required: true,
    maxRawLength: PAMI_PLANILLA_RENDERED_MAX + 500,
  });
}

export function validatePamiPlanillaForExport(
  template: PamiPlanillaTemplate,
  values: Record<string, string>,
  rendered: string
): { ok: true; values: PamiPlanillaValues } | { ok: false; error: string } {
  const contentError = validatePamiPlanillaHasUserContent(template, values);
  if (contentError) return { ok: false, error: contentError };

  const parsed = parsePamiPlanillaValues(template, values);
  if (!parsed.ok) return parsed;

  const renderedError = validatePamiPlanillaRendered(rendered);
  if (renderedError) return { ok: false, error: renderedError };

  return { ok: true, values: parsed.data };
}
