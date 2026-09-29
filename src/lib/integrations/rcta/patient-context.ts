import type { RctaPatientContext } from "@/lib/integrations/rcta/types";

export type RctaPatientRow = {
  first_name: string | null;
  last_name: string | null;
  document_type?: string | null;
  document_number: string | null;
  birth_date: string | null;
  sex?: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
};

const SEX_LABELS: Record<string, string> = {
  M: "Masculino",
  F: "Femenino",
  X: "X",
  male: "Masculino",
  female: "Femenino",
  other: "Otro",
};

function clean(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/** "12345678" → "12.345.678". Non-numeric identifiers are returned unchanged. */
export function formatDocumentNumber(value: string | null | undefined): string | null {
  const v = clean(value);
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  if (digits.length < 6 || digits.length !== v.replace(/[.\s-]/g, "").length) return v;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** ISO date (yyyy-mm-dd…) → dd/mm/yyyy without timezone shifts. */
export function formatBirthDate(value: string | null | undefined): string | null {
  const v = clean(value);
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/** Only identification + coverage fields. Never clinical notes, diagnoses or medications. */
export function buildRctaPatientContext(row: RctaPatientRow): RctaPatientContext {
  const fullName = [clean(row.first_name), clean(row.last_name)].filter(Boolean).join(" ");
  const sex = clean(row.sex);
  return {
    fullName: fullName || "Paciente",
    documentType: clean(row.document_type),
    documentNumber: clean(row.document_number)?.replace(/[.\s]/g, "") ?? null,
    documentNumberFormatted: formatDocumentNumber(row.document_number),
    birthDate: formatBirthDate(row.birth_date),
    sex: sex ? (SEX_LABELS[sex] ?? sex) : null,
    insuranceProvider: clean(row.insurance_provider),
    insuranceNumber: clean(row.insurance_number),
  };
}

/** Plain-text block for "Copiar datos del paciente". */
export function formatRctaPatientClipboard(ctx: RctaPatientContext): string {
  const docLabel = ctx.documentType && ctx.documentType.toUpperCase() !== "DNI" ? ctx.documentType : "DNI";
  const lines = [
    `Nombre: ${ctx.fullName}`,
    ctx.documentNumber ? `${docLabel}: ${ctx.documentNumber}` : null,
    ctx.birthDate ? `Fecha de nacimiento: ${ctx.birthDate}` : null,
    ctx.sex ? `Sexo: ${ctx.sex}` : null,
    ctx.insuranceProvider ? `Cobertura: ${ctx.insuranceProvider}` : null,
    ctx.insuranceNumber ? `N° afiliado: ${ctx.insuranceNumber}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}
