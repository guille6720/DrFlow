import { logAudit } from "@/core/auth/session.actions";
import { logServerError } from "@/core/errors/log-error.server";
import {
  CONSENT_TYPES,
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
} from "@/core/legal/documents";
import { createClient } from "@/core/supabase/server";

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
    logServerError("legal.acceptance-update", error, { clinicId });
    return { error: error.message };
  }

  // Phase 11: persist versioned consent history (clinic-level, patient_id null)
  const { error: termsConsentError } = await supabase.rpc("record_clinic_legal_consent", {
    p_clinic_id: clinicId,
    p_consent_type: CONSENT_TYPES.clinicTermsSignup,
    p_document_version: LEGAL_TERMS_VERSION,
    p_purpose: "clinic_terms_acceptance",
    p_source: "clinic_signup",
  });

  if (termsConsentError) {
    logServerError("legal.consent-terms-record", termsConsentError, { clinicId });
  }

  const { error: privacyConsentError } = await supabase.rpc("record_clinic_legal_consent", {
    p_clinic_id: clinicId,
    p_consent_type: CONSENT_TYPES.clinicPrivacySignup,
    p_document_version: LEGAL_PRIVACY_VERSION,
    p_purpose: "clinic_privacy_acceptance",
    p_source: "clinic_signup",
  });

  if (privacyConsentError) {
    logServerError("legal.consent-privacy-record", privacyConsentError, { clinicId });
  }

  await logAudit({
    clinicId,
    entityType: "legal",
    action: "create",
    metadata: {
      terms_version: LEGAL_TERMS_VERSION,
      privacy_version: LEGAL_PRIVACY_VERSION,
      consent_records_persisted: !termsConsentError && !privacyConsentError,
    },
  });

  return {};
}
