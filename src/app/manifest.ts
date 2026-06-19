import type { MetadataRoute } from "next";
import { PWA_ICONS } from "@/lib/utils/patient-portal-ready";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DrFlow — Consultorio",
    short_name: "DrFlow",
    description: "Agenda, pacientes e historia clínica en tu celular.",
    start_url: "/dashboard",
    scope: "/",
    id: "/dashboard",
    display: "standalone",
    background_color: "#eff6ff",
    theme_color: "#2563eb",
    orientation: "portrait",
    lang: "es-AR",
    icons: PWA_ICONS,
  };
}
