import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

import { sanitizeClinicalDisplayText } from "@/lib/utils/sanitize-clinical-display";

export function formatPatientEhrSidebarDate(iso: string): string {
  const d = new Date(iso);
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const yy = String(d.getFullYear()).slice(-2);
  return `${d.getDate()}-${months[d.getMonth()]}-${yy}`;
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
