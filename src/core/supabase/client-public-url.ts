"use client";

import { getPublicSiteUrl } from "@/core/supabase/env";

/** URL pública para OAuth / redirects desde componentes cliente. */
export function resolveClientPublicSiteUrl(): string {
  if (typeof window === "undefined") {
    return getPublicSiteUrl();
  }
  return getPublicSiteUrl(window.location.origin.replace(/\/$/, ""));
}
