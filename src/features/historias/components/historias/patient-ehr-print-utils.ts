import { format } from "date-fns";
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

export function formatPrintMetaDate(iso: string): string {
  return `${formatPrintFullDate(iso)} · N/A`;
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
  return consultation.professional_name.trim();
}
