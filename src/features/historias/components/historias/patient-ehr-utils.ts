import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

import { sanitizeClinicalDisplayText } from "@/lib/utils/sanitize-clinical-display";

export function formatPatientEhrSidebarDate(iso: string): string {
  const d = new Date(iso);
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const yy = String(d.getFullYear()).slice(-2);
  return `${d.getDate()}-${months[d.getMonth()]}-${yy}`;
}

export function toPatientEhrDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function isSameCalendarDay(aIso: string, bIso: string): boolean {
  const a = new Date(aIso);
  const b = new Date(bIso);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function calendarDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Una entrada por día de consulta (evolución principal), sin repetir fechas. */
export function buildConsultationSidebarList(
  sorted: PatientEhrConsultation[],
  evolutionList: PatientEhrConsultation[]
): PatientEhrConsultation[] {
  const evolutionOnly = sorted.filter((c) => c.category === "evolution");
  const source = evolutionOnly.length > 0 ? evolutionOnly : evolutionList;

  const byDay = new Map<string, PatientEhrConsultation>();
  for (const consultation of source) {
    const key = calendarDayKey(consultation.created_at);
    if (!byDay.has(key)) {
      byDay.set(key, consultation);
    }
  }

  return [...byDay.values()];
}

export function resolveSelectedConsultation(
  selectedId: string | null,
  sidebarList: PatientEhrConsultation[],
  evolutionList: PatientEhrConsultation[],
  sorted: PatientEhrConsultation[]
): PatientEhrConsultation | null {
  if (selectedId) {
    return (
      sidebarList.find((c) => c.id === selectedId) ??
      sorted.find((c) => c.id === selectedId) ??
      evolutionList.find((c) => c.id === selectedId) ??
      null
    );
  }

  return sidebarList[0] ?? evolutionList[0] ?? sorted[0] ?? null;
}

export function filterClinicalRowsByConsultationDay<
  T extends { recordCreatedAt: string },
>(rows: T[], consultationCreatedAt: string | null | undefined): T[] {
  if (!consultationCreatedAt) return rows;
  return rows.filter((row) => isSameCalendarDay(row.recordCreatedAt, consultationCreatedAt));
}

export function patientEhrEvolutionBody(c: PatientEhrConsultation): string {
  const evo = sanitizeClinicalDisplayText(c.evolution);
  if (evo.length > 0) return evo;
  const ccRaw = c.chief_complaint?.trim() ?? "";
  if (/^\[(?:IMPORT|DRAPP|HCE|PDF):/i.test(ccRaw)) {
    return "Sin texto de evolución registrado.";
  }
  const cc = sanitizeClinicalDisplayText(ccRaw);
  if (cc && !/^importado\b/i.test(cc)) return cc;
  return cc || "Sin texto de evolución registrado.";
}
