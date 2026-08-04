import { createClient } from "@/core/supabase/server";
import { logAudit } from "@/core/auth/session";
import {
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
} from "@/core/legal/documents";

/** Internal — apply legal acceptance during trusted setup flows. */
export async function applyClinicLegalAcceptanceInternal(clinicId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("clinics")
    .update({
      legal_terms_version: LEGAL_TERMS_VERSION,
      legal_terms_accepted_at: now,
      legal_privacy_version: LEGAL_PRIVACY_VERSION,
    })
    .eq("id", clinicId);

  if (error) {
    console.error("legal acceptance update failed:", error.message);
    return { error: error.message };
  }

  await logAudit({
    clinicId,
    entityType: "legal",
    action: "create",
    metadata: {
      terms_version: LEGAL_TERMS_VERSION,
      privacy_version: LEGAL_PRIVACY_VERSION,
    },
  });

  return {};
}
