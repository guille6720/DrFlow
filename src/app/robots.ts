import type { MetadataRoute } from "next";

import { getPublicSiteUrl } from "@/core/supabase/env";

/** Crawl rules — index marketing; exclude app/API/auth. */
export default function robots(): MetadataRoute.Robots {
  const base = getPublicSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/demo",
        "/probar",
        "/login",
        "/register",
        "/privacidad",
        "/terminos",
        "/aviso-paciente",
        "/solicitar-turno/",
      ],
      disallow: [
        "/api/",
        "/auth/",
        "/portal/",
        "/agenda",
        "/pacientes",
        "/historias",
        "/configuracion",
        "/dashboard",
        "/caja",
        "/atenciones",
        "/recetas",
        "/reportes",
        "/onboarding",
        "/qa",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
