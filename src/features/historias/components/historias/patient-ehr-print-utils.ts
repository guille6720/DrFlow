import { format, intervalToDuration, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";

import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

export function formatPrintHeaderDate(iso: string): string {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(-2);
  return `${d.getDate()}-${MONTHS[d.getMonth()]}-${yy}`;
}

export function formatPrintTableDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}-${MONTHS[d.getMonth()]}`;
}

export function formatPrintFullDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

export function formatPrintTime(iso: string): string {
  return format(new Date(iso), "H:mm:ss", { locale: es });
}

/** Meta bajo diagnósticos en tablas resumen (export Equipos). */
export function formatPrintDiagnosisMetaDate(iso: string): string {
  return `${formatPrintFullDate(iso)} · N/A`;
}

/** Meta bajo tratamientos en tablas resumen (export Equipos). */
export function formatPrintTreatmentMetaDate(iso: string): string {
  return `${formatPrintFullDate(iso)} · (n/a)`;
}

/** @deprecated Use formatPrintDiagnosisMetaDate or formatPrintTreatmentMetaDate */
export function formatPrintMetaDate(iso: string): string {
  return formatPrintDiagnosisMetaDate(iso);
}

/** DNI con separador de miles (12.459.480). */
export function formatPrintDocumentNumber(documentNumber: string): string {
  const digits = documentNumber.replace(/\D/g, "");
  if (!digits) return documentNumber;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Fecha de nacimiento como en export Equipos: 21 MAY 1936 */
export function formatPrintBirthDate(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  const d = parseISO(birthDate.includes("T") ? birthDate : `${birthDate}T12:00:00`);
  if (!isValid(d)) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Edad detallada: 90 años 2 meses 17 días */
export function formatPrintDetailedAge(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  const d = parseISO(birthDate.includes("T") ? birthDate : `${birthDate}T12:00:00`);
  if (!isValid(d)) return null;
  const duration = intervalToDuration({ start: d, end: new Date() });
  const parts: string[] = [];
  if (duration.years) parts.push(`${duration.years} años`);
  if (duration.months) parts.push(`${duration.months} meses`);
  if (duration.days !== undefined) parts.push(`${duration.days} días`);
  return parts.length > 0 ? parts.join(" ") : null;
}

export function formatPrintAgeBlock(
  birthDate: string | null | undefined,
  fallbackAgeLabel: string | null | undefined
): string {
  const birth = formatPrintBirthDate(birthDate);
  const detailed = formatPrintDetailedAge(birthDate);
  if (birth && detailed) return `${birth}\n${detailed}`;
  return birth ?? detailed ?? fallbackAgeLabel ?? "Sin definir";
}

export function parseInlineDiagnoses(consultation: PatientEhrConsultation): string[] {
  const raw = consultation.diagnosis?.trim();
  if (!raw) return [];
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export type PrintInlineTreatment = {
  product: string;
  dose: string;
};

export function parseInlineTreatments(consultation: PatientEhrConsultation): PrintInlineTreatment[] {
  const raw = consultation.indications?.trim();
  if (!raw) return [];

  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !/^estado\s*:/i.test(line));

  const result: PrintInlineTreatment[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const next = lines[i + 1];
    if (next && /\d+\s*mg|comp\.|caps\.|comp\.ran\./i.test(next)) {
      result.push({ product: line, dose: next });
      i += 1;
      continue;
    }

    const split = line.match(/^(.+?)\s+(\d[\d.,]*\s*mg.*)$/i);
    if (split) {
      result.push({ product: split[1].trim(), dose: split[2].trim() });
      continue;
    }

    result.push({ product: line, dose: "" });
  }

  return result;
}

export function professionalMetaLine(consultation: PatientEhrConsultation): string {
  const parts = [consultation.professional_name.trim()];
  const national = consultation.professional_license_national?.trim();
  const provincial = consultation.professional_license_provincial?.trim();
  if (national) parts.push(national);
  if (provincial && provincial !== national) parts.push(provincial);
  const email = consultation.professional_email?.trim();
  if (email) parts.push(email);
  return parts.join(" ");
}
