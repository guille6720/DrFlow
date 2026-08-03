import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeText } from "@/lib/validations/schemas";
import type { ExtractedPatientInfo } from "@/lib/utils/pdf-patient-extract";
import { upsertPatientClinicalProfile } from "@/lib/server/patient-clinical-profile";

export { extractTextFromPdfBuffer } from "@/lib/utils/pdf-text-extract.server";

export async function findOrCreatePatientFromExtract(
  supabase: SupabaseClient,
  clinicId: string,
  extract: ExtractedPatientInfo,
  defaultInsurance: string | null,
  importNote: string
): Promise<{ patientId: string; created: boolean; patientName: string } | { error: string }> {
  const { data: existing } = await supabase
    .from("patients")
    .select("id, first_name, last_name, is_active")
    .eq("clinic_id", clinicId)
    .eq("document_number", extract.document_number)
    .maybeSingle();

  if (existing) {
    if (!existing.is_active) {
      await supabase.from("patients").update({ is_active: true }).eq("id", existing.id);
    }
    return {
      patientId: existing.id,
      created: false,
      patientName: `${existing.last_name}, ${existing.first_name}`,
    };
  }

  const { data, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: clinicId,
      document_number: extract.document_number,
      first_name: sanitizeText(extract.first_name),
      last_name: sanitizeText(extract.last_name),
      insurance_provider: defaultInsurance,
      is_active: true,
    })
    .select("id, first_name, last_name")
    .single();

  if (error) {
    if (error.message.includes("unique") || error.code === "23505") {
      const { data: retry } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("clinic_id", clinicId)
        .eq("document_number", extract.document_number)
        .single();
      if (retry) {
        return {
          patientId: retry.id,
          created: false,
          patientName: `${retry.last_name}, ${retry.first_name}`,
        };
      }
    }
    return { error: error.message };
  }

  await upsertPatientClinicalProfile(supabase, data.id, clinicId, {
    notes: importNote,
  });

  return {
    patientId: data.id,
    created: true,
    patientName: `${data.last_name}, ${data.first_name}`,
  };
}

export async function enrichPatientFromLegacyPdfDemographics(
  supabase: SupabaseClient,
  patientId: string,
  clinicId: string,
  demographics: {
    phone: string | null;
    insurance_provider: string | null;
    insurance_number: string | null;
    birth_date: string | null;
    chronic_diagnoses: string[];
  }
): Promise<void> {
  const [{ data: patient }, { data: profile }] = await Promise.all([
    supabase
      .from("patients")
      .select("phone, insurance_provider, insurance_number, birth_date")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .single(),
    supabase
      .from("patient_clinical_profiles")
      .select("medical_history")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .maybeSingle(),
  ]);

  if (!patient) return;

  const patientUpdates: Record<string, string> = {};
  if (!patient.phone?.trim() && demographics.phone) {
    patientUpdates.phone = sanitizeText(demographics.phone);
  }
  if (!patient.insurance_number?.trim() && demographics.insurance_number) {
    patientUpdates.insurance_number = sanitizeText(demographics.insurance_number);
  }
  if (!patient.insurance_provider?.trim() && demographics.insurance_provider) {
    patientUpdates.insurance_provider = sanitizeText(demographics.insurance_provider);
  }
  if (!patient.birth_date && demographics.birth_date) {
    patientUpdates.birth_date = demographics.birth_date;
  }

  if (Object.keys(patientUpdates).length > 0) {
    await supabase.from("patients").update(patientUpdates).eq("id", patientId).eq("clinic_id", clinicId);
  }

  if (demographics.chronic_diagnoses.length === 0) return;

  const block = demographics.chronic_diagnoses.join("; ");
  const prefix = "Diagnósticos crónicos (importación): ";
  const currentHistory = profile?.medical_history ?? null;
  if (currentHistory?.includes(block)) return;

  const merged = currentHistory?.trim()
    ? `${currentHistory.trim()}\n\n${prefix}${block}`
    : `${prefix}${block}`;

  await upsertPatientClinicalProfile(supabase, patientId, clinicId, {
    medical_history: sanitizeText(merged),
  });
}

export async function resolveImportProfessionalId(
  supabase: SupabaseClient,
  clinicId: string,
  professionalName: string
): Promise<string | null> {
  const { data: professionals } = await supabase
    .from("professionals")
    .select("id, display_name, profiles(full_name)")
    .eq("clinic_id", clinicId)
    .eq("is_active", true);

  if (!professionals?.length) return null;

  const target = professionalName.toLowerCase().replace(/\s+/g, " ").trim();
  const [targetLast, ...targetRest] = target.split(",").map((s) => s.trim());
  const targetFirst = targetRest.join(" ").split(/\s+/)[0] ?? "";

  for (const pro of professionals) {
    const display = (
      pro.display_name ??
      (pro.profiles as { full_name?: string } | null)?.full_name ??
      ""
    )
      .toLowerCase()
      .replace(/\s+/g, " ");

    if (!display) continue;
    if (display.includes(targetLast) && (!targetFirst || display.includes(targetFirst))) {
      return pro.id;
    }
    if (target.includes(display.split(" ")[0] ?? "")) {
      return pro.id;
    }
  }

  return professionals[0]?.id ?? null;
}

export async function insertLegacyPdfClinicalRecords(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    patientId: string;
    userId: string;
    evolutions: Array<{
      marker: string;
      consultationDate: string;
      professionalName: string;
      chief_complaint: string;
      evolution: string;
      diagnosis: string;
      indications: string;
    }>;
  }
): Promise<{ created: number; skipped: number; error?: string }> {
  let created = 0;
  let skipped = 0;

  for (const entry of params.evolutions) {
    const { data: existing } = await supabase
      .from("clinical_records")
      .select("id")
      .eq("clinic_id", params.clinicId)
      .eq("patient_id", params.patientId)
      .ilike("chief_complaint", `${entry.marker}%`)
      .maybeSingle();

    if (existing) {
      skipped += 1;
      continue;
    }

    const professionalId = await resolveImportProfessionalId(
      supabase,
      params.clinicId,
      entry.professionalName
    );
    if (!professionalId) {
      return {
        created,
        skipped,
        error: "No hay profesionales activos en la clínica para asociar las evoluciones.",
      };
    }

    const createdAt = `${entry.consultationDate}T12:00:00.000Z`;
    const { data: record, error } = await supabase
      .from("clinical_records")
      .insert({
        clinic_id: params.clinicId,
        patient_id: params.patientId,
        professional_id: professionalId,
        chief_complaint: sanitizeText(entry.chief_complaint),
        evolution: sanitizeText(entry.evolution),
        diagnosis: sanitizeText(entry.diagnosis),
        indications: sanitizeText(entry.indications),
        created_by: params.userId,
        created_at: createdAt,
        updated_at: createdAt,
      })
      .select("id")
      .single();

    if (error) {
      return { created, skipped, error: error.message };
    }

    await supabase.from("clinical_record_audit").insert({
      clinical_record_id: record.id,
      clinic_id: params.clinicId,
      action: "create",
      changed_by: params.userId,
      new_values: { source: "legacy_pdf_import", marker: entry.marker },
    });

    created += 1;
  }

  return { created, skipped };
}

export async function insertCompactClinicalPdfStructuralRecords(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    patientId: string;
    userId: string;
    consultationDate: string;
    professionalName: string;
    diagnosisName: string | null;
    treatments: Array<{ product: string; dose: string; notes: string }>;
  }
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  const professionalId = await resolveImportProfessionalId(
    supabase,
    params.clinicId,
    params.professionalName
  );
  if (!professionalId) return { created: 0, skipped: 0 };

  const createdAt = `${params.consultationDate}T12:00:00.000Z`;

  if (params.diagnosisName) {
    const marker = `[PDF:${params.consultationDate}:diagnostics:1]`;
    const { data: existing } = await supabase
      .from("clinical_records")
      .select("id")
      .eq("clinic_id", params.clinicId)
      .eq("patient_id", params.patientId)
      .ilike("chief_complaint", `${marker}%`)
      .maybeSingle();
    if (existing) skipped += 1;
    else {
      await supabase.from("clinical_records").insert({
        clinic_id: params.clinicId,
        patient_id: params.patientId,
        professional_id: professionalId,
        chief_complaint: sanitizeText(`${marker} Diagnóstico importado (PDF)`),
        diagnosis: sanitizeText(params.diagnosisName),
        evolution: "",
        indications: "",
        created_by: params.userId,
        created_at: createdAt,
        updated_at: createdAt,
      });
      created += 1;
    }
  }

  for (let i = 0; i < params.treatments.length; i += 1) {
    const t = params.treatments[i];
    const marker = `[PDF:${params.consultationDate}:treatments:${i + 1}]`;
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
    await supabase.from("clinical_records").insert({
      clinic_id: params.clinicId,
      patient_id: params.patientId,
      professional_id: professionalId,
      chief_complaint: sanitizeText(`${marker} Tratamiento importado (PDF)`),
      diagnosis: sanitizeText(t.product),
      evolution: sanitizeText(t.notes),
      indications: sanitizeText(t.dose),
      created_by: params.userId,
      created_at: createdAt,
      updated_at: createdAt,
    });
    created += 1;
  }

  return { created, skipped };
}

