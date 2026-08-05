import {
  PATIENT_PWA_ICON_192,
  PATIENT_PWA_ICON_512,
} from "@/features/pacientes/utils/patient-portal-ready";

/** Picks the smallest PWA asset that covers the rendered size (keeps retina sharpness). */
export function resolvePatientAppIconSrc(displayPx: number): string {
  return displayPx <= 96 ? PATIENT_PWA_ICON_192 : PATIENT_PWA_ICON_512;
}

/** Declares rendered width for Next.js `sizes` on brand icons. */
export function brandIconSizes(displayPx: number): string {
  return `${displayPx}px`;
}
