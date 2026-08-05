import type { MetadataRoute } from "next";

import { getPublicSiteUrl } from "@/core/supabase/env";

const PUBLIC_PATHS = [
  "/",
  "/demo",
  "/probar",
  "/login",
  "/register",
  "/privacidad",
  "/terminos",
  "/aviso-paciente",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPublicSiteUrl();
  const now = new Date();

  return PUBLIC_PATHS.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/demo" ? 0.9 : 0.7,
  }));
}
