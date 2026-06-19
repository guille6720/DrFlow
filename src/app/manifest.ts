import type { MetadataRoute } from "next";
import { getPwaIcons } from "@/lib/utils/patient-portal-ready";
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
    background_color: "#2563eb",
    theme_color: "#2563eb",
    orientation: "portrait",
    lang: "es-AR",
    icons: getPwaIcons(origin),
  };
}
