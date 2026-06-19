import { PATIENT_CONTACT_PHONE_DISCLAIMER } from "@/lib/constants/medical-specialties";
import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";
import { buildSharePhoneLine } from "@/lib/utils/doctor-share-info";

const storageKey = (slug: string) => `drflow-portal-instalado-${slug}`;

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** App azul del consultorio abierta como PWA (no navegador). */
export function isConsultorioStandalone(): boolean {
  if (!isStandaloneMode()) return false;
  return !window.location.pathname.startsWith("/portal/");
}

/** App verde del paciente abierta como PWA. */
export function isPatientStandalone(slug?: string): boolean {
  if (!isStandaloneMode()) return false;
  const path = window.location.pathname;
  if (!path.startsWith("/portal/")) return false;
  if (slug) return path.startsWith(`/portal/${slug}`);
  return true;
}

/** Portal listo: app verde instalada en pantalla de inicio. */
export function isPatientPortalReady(slug: string): boolean {
  if (typeof window === "undefined") return false;
  if (isPatientStandalone(slug)) return true;
  try {
    return localStorage.getItem(storageKey(slug)) === "1";
  } catch {
    return false;
  }
}

export function markPatientPortalInstalled(slug: string): void {
  try {
    localStorage.setItem(storageKey(slug), "1");
  } catch {
    /* storage no disponible */
  }
}

/** Azul — app del médico / consultorio. */
export const DOCTOR_THEME_COLOR = "#2563eb";

/** Verde — app del paciente (icono en pantalla de inicio). */
export const PATIENT_THEME_COLOR = "#059669";

export const DOCTOR_PWA_ICON_192 = "/icon-192.png";
export const DOCTOR_PWA_ICON_512 = "/icon-512.png";
export const PATIENT_PWA_ICON_192 = "/icon-patient-192.png";
export const PATIENT_PWA_ICON_512 = "/icon-patient-512.png";

/** Iconos PWA del consultorio (azul). */
export function getPwaIcons(origin: string) {
  const base = origin.replace(/\/$/, "");
  return [
    {
      src: `${base}${DOCTOR_PWA_ICON_192}`,
      sizes: "192x192",
      type: "image/png",
      purpose: "any" as const,
    },
    {
      src: `${base}${DOCTOR_PWA_ICON_512}`,
      sizes: "512x512",
      type: "image/png",
      purpose: "any" as const,
    },
    {
      src: `${base}/icon-maskable-512.png`,
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable" as const,
    },
  ];
}

/** Iconos PWA del portal pacientes (verde). */
export function getPatientPwaIcons(origin: string) {
  const base = origin.replace(/\/$/, "");
  return [
    {
      src: `${base}${PATIENT_PWA_ICON_192}`,
      sizes: "192x192",
      type: "image/png",
      purpose: "any" as const,
    },
    {
      src: `${base}${PATIENT_PWA_ICON_512}`,
      sizes: "512x512",
      type: "image/png",
      purpose: "any" as const,
    },
    {
      src: `${base}/icon-patient-maskable-512.png`,
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable" as const,
    },
  ];
}

/** Rutas relativas para metadata HTML del consultorio. */
export const PWA_ICONS = getPwaIcons("");

export const PWA_APPLE_ICON = DOCTOR_PWA_ICON_192;
export const PATIENT_PWA_APPLE_ICON = PATIENT_PWA_ICON_192;

export const PATIENT_PWA_METADATA_ICONS = {
  icon: [
    { url: PATIENT_PWA_ICON_192, sizes: "192x192", type: "image/png" },
    { url: PATIENT_PWA_ICON_512, sizes: "512x512", type: "image/png" },
  ],
  apple: [{ url: PATIENT_PWA_APPLE_ICON, sizes: "192x192", type: "image/png" }],
};

export function buildPatientAppInstallUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, "")}/portal/${slug}/instalar`;
}

export function buildPatientAppShareMessage(
  doctor: DoctorShareInfo,
  installUrl: string,
  patientName?: string
): string {
  const greeting = patientName ? `Hola ${patientName}!` : "Hola!";
  const licenseLine = doctor.licenseLabel ? `\n${doctor.licenseLabel}` : "";
  const specialtyLine = doctor.specialty ? `\n${doctor.specialty}` : "";
  const phoneLine = buildSharePhoneLine(doctor.phone);

  return [
    `${greeting}`,
    "",
    `${doctor.fullName}${licenseLine}${specialtyLine}`,
    "",
    "Instalá la app para pedir turnos y recetas PAMI:",
    installUrl,
    "",
    phoneLine,
    "",
    "Pasos:",
    "1. Tocá el link de arriba",
    '2. Apretá "Agregar a pantalla de inicio"',
    "3. Listo — queda el icono verde «Pacientes» en tu pantalla de inicio",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function buildPatientAppOgDescription(doctor: DoctorShareInfo): string {
  const parts = [
    doctor.fullName,
    doctor.licenseLabel,
    doctor.specialty,
    buildSharePhoneLine(doctor.phone),
  ].filter(Boolean);
  return parts.join(" · ") || `App de ${doctor.clinicName} para turnos y recetas PAMI.`;
}

export { PATIENT_CONTACT_PHONE_DISCLAIMER };
