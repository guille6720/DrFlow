import type { MetadataRoute } from "next";
import { DOCTOR_THEME_COLOR, getPwaIcons } from "@/lib/utils/patient-portal-ready";
import { getSiteUrl } from "@/lib/supabase/env";

export default function manifest(): MetadataRoute.Manifest {
  const origin = getSiteUrl();
  return {
    name: "DrFlow — Consultorio",
    short_name: "DrFlow",
    description: "Agenda, pacientes e historia clínica en tu celular.",
    start_url: "/dashboard",
    scope: "/",
    id: "/dashboard",
    display: "standalone",
    background_color: DOCTOR_THEME_COLOR,
    theme_color: DOCTOR_THEME_COLOR,
    orientation: "portrait",
    lang: "es-AR",
    icons: getPwaIcons(origin),
    // No capturar links /portal/* en la app azul; el paciente instala la app verde aparte.
    handle_links: "not-preferred",
  } as MetadataRoute.Manifest;
}
