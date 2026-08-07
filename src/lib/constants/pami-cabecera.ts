/* PAMI médico de cabecera: perfiles, plantillas y estudios frecuentes.
 * User-facing strings live in @/locales/es-AR/pami/cabecera-clinical. */

import { pamiCabeceraClinicalEsAr } from "@/locales/es-AR/pami/cabecera-clinical";

export const PAMI_INSURANCE = pamiCabeceraClinicalEsAr.insurance;
export const PAMI_PRACTICE_PROFILE = "cabecera_pami";
export const PAMI_DEFAULT_SLOT_MINUTES = 20;

export const PAMI_CONSULTATION_REASONS = pamiCabeceraClinicalEsAr.consultationReasons;

export const PAMI_STUDY_TEMPLATES = pamiCabeceraClinicalEsAr.studyTemplates;

export const PAMI_REFERRAL_TEMPLATES = pamiCabeceraClinicalEsAr.referralTemplates;

export const PAMI_CLINICAL_TEMPLATES = pamiCabeceraClinicalEsAr.clinicalTemplates;

export function buildPamiReminderMessage(
  patientName: string,
  dateLabel: string,
  professionalName: string,
  clinicName: string
): string {
  return pamiCabeceraClinicalEsAr.reminderMessage(
    patientName,
    dateLabel,
    professionalName,
    clinicName
  );
}
