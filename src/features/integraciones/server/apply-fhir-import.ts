import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isUniqueViolation } from "@/core/errors/postgres-error";
import type { FhirImportDraft, FhirImportPatientDraft } from "@/core/services/interoperability/fhir";
import { sanitizeText } from "@/core/validations/schemas";

import {
  type DuplicateDecisionSet,
  resolveDuplicateDecision,
} from "@/features/integraciones/lib/patient-import-duplicates";
import { withDefaultDecisions } from "@/features/integraciones/server/prepare-patient-import";
import { loadPatientClinicalProfile, upsertPatientClinicalProfile } from "@/features/pacientes/server/patient-clinical-profile";

import { resolveImportProfessionalId } from "@/lib/utils/clinical-pdf-import";

export type AppliedFhirImport = {
  patientsCreated: number;
  patientsUpdated: number;
  patientsSkipped: number;
  recordsCreated: number;
  recordsSkipped: number;
  warnings: string[];
};

function fhirEncounterMarker(documentNumber: string, localKey: string): string {
  return `[FHIR:${documentNumber}:${localKey}]`;
}

async function fillEmptyDemographics(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  incoming: FhirImportPatientDraft["demographics"]
) {
  const { data: patient } = await supabase
    .from("patients")
    .select("phone, email, address, birth_date, emergency_contact_name, emergency_contact_phone")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!patient) return false;
  const updates: Record<string, string> = {};
  const fill = (column: string, next: string | null, current: string | null) => {
    if (!current?.trim() && next) updates[column] = sanitizeText(next);
  };
  fill("phone", incoming.phone, patient.phone);
  fill("email", incoming.email, patient.email);
  fill("address", incoming.address, patient.address);
  fill("emergency_contact_name", incoming.emergency_contact_name, patient.emergency_contact_name);
  fill("emergency_contact_phone", incoming.emergency_contact_phone, patient.emergency_contact_phone);
  if (!patient.birth_date && incoming.birth_date) updates.birth_date = incoming.birth_date;
  if (Object.keys(updates).length === 0) return false;
  await supabase.from("patients").update(updates).eq("id", patientId).eq("clinic_id", clinicId);
  return true;
}

async function fillEmptyProfile(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  draft: FhirImportPatientDraft
) {
  const profile = await loadPatientClinicalProfile(supabase, patientId, clinicId);
  const next = {
    allergies: profile?.allergies || draft.allergies,
    medical_history: profile?.medical_history || draft.medicalHistory,
    regular_medication: profile?.regular_medication || draft.regularMedication,
    notes: profile?.notes ?? null,
  };
  if (
    next.allergies === (profile?.allergies ?? null) &&
    next.medical_history === (profile?.medical_history ?? null) &&
    next.regular_medication === (profile?.regular_medication ?? null)
  ) {
    return;
  }
  await upsertPatientClinicalProfile(supabase, patientId, clinicId, next);
}

async function appendEncounters(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    userId: string;
    patientId: string;
    documentNumber: string;
    draft: FhirImportPatientDraft;
  }
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const encounter of params.draft.encounters) {
    const marker = fhirEncounterMarker(params.documentNumber, encounter.localKey);
    const { data: existing } = await supabase
      .from("clinical_records")
      .select("id")
      .eq("clinic_id", params.clinicId)
      .eq("patient_id", params.patientId)
      .ilike("chief_complaint", `${marker}%`)
      .maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }
    const professionalId = encounter.professionalName
      ? await resolveImportProfessionalId(supabase, params.clinicId, encounter.professionalName)
      : null;
    const createdAt = encounter.date ? `${encounter.date}T12:00:00.000Z` : new Date().toISOString();
    const complaint = sanitizeText(
      `${marker} ${encounter.chiefComplaint || "Migración FHIR"}`.trim()
    );
    const { error } = await supabase.from("clinical_records").insert({
      clinic_id: params.clinicId,
      patient_id: params.patientId,
      professional_id: professionalId,
      chief_complaint: complaint,
      diagnosis: sanitizeText(encounter.diagnosis),
      evolution: sanitizeText(encounter.evolution),
      indications: sanitizeText(encounter.indications),
      professional_signature: encounter.professionalName
        ? sanitizeText(encounter.professionalName)
        : null,
      created_by: params.userId,
      created_at: createdAt,
      updated_at: createdAt,
    });
    if (error) skipped += 1;
    else created += 1;
  }
  return { created, skipped };
}

export async function applyFhirImportDraft(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    userId: string;
    draft: FhirImportDraft;
    decisions?: DuplicateDecisionSet | null;
    duplicatesByLine: Map<number, "document" | "name_dob">;
    existingByDocument: Map<string, string>;
    existingByNameDob: Map<string, string>;
  }
): Promise<AppliedFhirImport> {
  const decisions = withDefaultDecisions(params.decisions);
  const result: AppliedFhirImport = {
    patientsCreated: 0,
    patientsUpdated: 0,
    patientsSkipped: 0,
    recordsCreated: 0,
    recordsSkipped: 0,
    warnings: [...params.draft.warnings, ...params.draft.issues],
  };

  for (const patient of params.draft.patients) {
    const dni = patient.demographics.document_number;
    if (!dni) {
      result.patientsSkipped += 1;
      continue;
    }
    const matchType = params.duplicatesByLine.get(patient.demographics.lineNumber) ?? null;
    const decision = resolveDuplicateDecision(decisions, patient.demographics.lineNumber, matchType);
    const existingId =
      params.existingByDocument.get(dni) ??
      (patient.demographics.birth_date
        ? params.existingByNameDob.get(
            `${patient.demographics.last_name.toLowerCase()}|${patient.demographics.first_name.toLowerCase()}|${patient.demographics.birth_date}`
          )
        : undefined);

    if (existingId && (decision === "skip" || decision === "review")) {
      result.patientsSkipped += 1;
      continue;
    }

    let patientId = existingId ?? null;
    if (!patientId) {
      const inserted = await supabase
        .from("patients")
        .insert({
          clinic_id: params.clinicId,
          document_number: dni,
          first_name: sanitizeText(patient.demographics.first_name),
          last_name: sanitizeText(patient.demographics.last_name),
          birth_date: patient.demographics.birth_date,
          phone: patient.demographics.phone,
          email: patient.demographics.email,
          address: patient.demographics.address,
          is_active: true,
        })
        .select("id")
        .single();
      if (inserted.error || !inserted.data) {
        if (inserted.error && isUniqueViolation(inserted.error)) {
          const { data: retry } = await supabase
            .from("patients")
            .select("id")
            .eq("clinic_id", params.clinicId)
            .eq("document_number", dni)
            .maybeSingle();
          if (!retry) {
            result.patientsSkipped += 1;
            result.warnings.push(`No se pudo crear DNI ${dni}: ${inserted.error.message}`);
            continue;
          }
          patientId = retry.id;
        } else {
          result.patientsSkipped += 1;
          result.warnings.push(`No se pudo crear DNI ${dni}: ${inserted.error?.message ?? "error"}`);
          continue;
        }
      } else {
        patientId = inserted.data.id;
        result.patientsCreated += 1;
      }
    } else if (decision === "update") {
      await fillEmptyDemographics(supabase, params.clinicId, patientId, patient.demographics);
      result.patientsUpdated += 1;
    }

    if (!patientId) {
      result.patientsSkipped += 1;
      continue;
    }

    await fillEmptyProfile(supabase, params.clinicId, patientId, patient);
    const records = await appendEncounters(supabase, {
      clinicId: params.clinicId,
      userId: params.userId,
      patientId,
      documentNumber: dni,
      draft: patient,
    });
    result.recordsCreated += records.created;
    result.recordsSkipped += records.skipped;
  }

  return result;
}
