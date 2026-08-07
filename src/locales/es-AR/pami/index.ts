import { pamiAdminMessages } from "@/locales/es-AR/pami/admin";
import { pamiCabeceraClinicalEsAr } from "@/locales/es-AR/pami/cabecera-clinical";
import { pamiGuiaMessages } from "@/locales/es-AR/pami/guia";
import { pamiNavMessages } from "@/locales/es-AR/pami/nav";
import { pamiPatientBannerMessages } from "@/locales/es-AR/pami/patient-banner";
import { pamiPlanillasMessages } from "@/locales/es-AR/pami/planillas";
import { pamiSetupMessages } from "@/locales/es-AR/pami/setup";
import { pamiValidationMessages } from "@/locales/es-AR/pami/validation";

/** All PAMI user-facing strings for es-AR. */
export const pamiMessagesEsAr = {
  planillas: pamiPlanillasMessages,
  validation: pamiValidationMessages,
  setup: pamiSetupMessages,
  admin: pamiAdminMessages,
  guia: pamiGuiaMessages,
  nav: pamiNavMessages,
  patientBanner: pamiPatientBannerMessages,
  cabeceraClinical: pamiCabeceraClinicalEsAr,
} as const;

export type PamiMessages = typeof pamiMessagesEsAr;
