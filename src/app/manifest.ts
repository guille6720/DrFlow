import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DrFlow — Consultorio",
    short_name: "DrFlow",
    description: "Agenda, pacientes e historia clínica en tu celular.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
  background_color: "#eff6ff",
  theme_color: "#2563eb",
    orientation: "portrait",
    lang: "es-AR",
    icons: [
      {
        src: "/drflow-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
