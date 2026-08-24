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

export function parseInlineDiagnoses(consultation: PatientEhrConsultation): PrintInlineDiagnosis[] {
  const raw = consultation.diagnosis?.trim();
  if (!raw) return [];
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseDiagnosisLine);
}

export type PrintInlineDiagnosis = {
  text: string;
  code: string | null;
};

/** Separa texto diagnóstico de código CIE (p. ej. "… anterior I-210"). */
export function parseDiagnosisLine(line: string): PrintInlineDiagnosis {
  const match = line.match(/^(.+?)\s+([A-Z]\d{2,3}(?:\.\d+)?|[A-Z]-\d{2,3})$/i);
  if (match) {
    return { text: match[1].trim(), code: match[2].toUpperCase() };
  }
  return { text: line, code: null };
}

export type PrintInlineTreatment = {
  product: string;
  lab: string;
  dose: string;
};

function looksLikeDoseLine(line: string): boolean {
  return /\d+\s*mg|comp\.|caps\.|comp\.ran\.|ui\.|ml\./i.test(line);
}

/** Separa nombre comercial y laboratorio ("GASTEC Laboratorios Be"). */
export function splitTreatmentProductLab(line: string): { product: string; lab: string } {
  const trimmed = line.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 1) return { product: trimmed, lab: "" };

  const first = parts[0];
  const rest = parts.slice(1).join(" ");
  if (looksLikeDoseLine(rest)) return { product: trimmed, lab: "" };
  return { product: first, lab: rest };
}

/**
 * Phase 3: indications TEXT is a printable snapshot only.
 * Do not invent structured treatment rows from free text.
 * @deprecated Prefer getIndicationsSnapshot + structured treatmentRows.
 */
export function parseInlineTreatments(_consultation: PatientEhrConsultation): PrintInlineTreatment[] {
  return [];
}

/** Snapshot imprimible de indicaciones (texto libre / Phase 3 dual-write). */
export function getIndicationsSnapshot(consultation: PatientEhrConsultation): string | null {
  const raw = consultation.indications?.trim();
  return raw || null;
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
