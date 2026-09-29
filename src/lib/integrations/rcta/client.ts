/**
 * RCTA launcher (phase 1: external link).
 *
 * Security model for the FUTURE official API:
 *   NexClinic UI → NexClinic server action / route handler → RCTA official API
 * Never: Browser → RCTA API with private credentials.
 * Any RCTA API key, client secret or token must live in server-only env vars (no `NEXT_PUBLIC_`), be read
 * from a `server-only` module, and requests must derive clinic/professional/patient from the session.
 *
 * TODO: Implement official RCTA API once vendor documentation and credentials are available.
 * Until then there are NO RCTA endpoints, auth flows or payload formats in this codebase.
 */

import { RCTA_EXTERNAL_URL } from "@/lib/integrations/rcta/config";
import type { RctaDocumentKind, RctaIntegration } from "@/lib/integrations/rcta/types";

/** The launch URL is identical for every document kind and never carries patient data. */
export function getRctaLaunchUrl(_kind: RctaDocumentKind, baseUrl: string = RCTA_EXTERNAL_URL): string {
  return baseUrl;
}

type WindowOpener = (url: string, target: string, features: string) => unknown;

/** Programmatic launcher (the UI uses plain anchors; this keeps a single seam for a future API mode). */
export function createExternalRctaIntegration(
  open: WindowOpener = (url, target, features) => window.open(url, target, features),
  baseUrl: string = RCTA_EXTERNAL_URL
): RctaIntegration {
  const launch = (kind: RctaDocumentKind) => {
    open(getRctaLaunchUrl(kind, baseUrl), "_blank", "noopener,noreferrer");
  };
  return {
    mode: "external_link",
    openExternalPrescription: () => launch("prescription"),
    openExternalMedicalOrder: () => launch("medical_order"),
  };
}
