import { isCanonicalPamiCoverage } from "@/lib/integrations/pami/coverage";
import type { PamiPatientContext } from "@/lib/integrations/pami/types";
import { buildRctaPatientContext, type RctaPatientRow } from "@/lib/integrations/rcta/patient-context";

export type PamiPatientRow = RctaPatientRow & { cuil?: string | null };

/** "20123456783" → "20-12345678-3". Other shapes are returned trimmed. */
export function formatCuil(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  if (digits.length !== 11) return v;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

/** Only identification + coverage fields. Never clinical notes, diagnoses or medications. */
export function buildPamiPatientContext(row: PamiPatientRow): PamiPatientContext {
  const base = buildRctaPatientContext(row);
  const cuilFormatted = formatCuil(row.cuil);
  return {
    ...base,
    cuil: cuilFormatted ? cuilFormatted.replace(/\D/g, "") : null,
    cuilFormatted,
    pamiCoverage: isCanonicalPamiCoverage(row.insurance_provider),
  };
}

/** Plain-text block for "Copiar datos del paciente". */
export function formatPamiPatientClipboard(ctx: PamiPatientContext): string {
  const docLabel = ctx.documentType && ctx.documentType.toUpperCase() !== "DNI" ? ctx.documentType : "DNI";
  const lines = [
    `Nombre: ${ctx.fullName}`,
    ctx.documentNumber ? `${docLabel}: ${ctx.documentNumber}` : null,
    ctx.cuilFormatted ? `CUIL: ${ctx.cuilFormatted}` : null,
    ctx.birthDate ? `Fecha de nacimiento: ${ctx.birthDate}` : null,
    ctx.sex ? `Sexo: ${ctx.sex}` : null,
    ctx.pamiCoverage ? "Cobertura: PAMI" : ctx.insuranceProvider ? `Cobertura: ${ctx.insuranceProvider}` : null,
    ctx.insuranceNumber ? `N° afiliado: ${ctx.insuranceNumber}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}
