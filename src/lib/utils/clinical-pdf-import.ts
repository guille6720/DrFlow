import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeText } from "@/lib/validations/schemas";
import type { ExtractedPatientInfo } from "@/lib/utils/pdf-patient-extract";

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
      notes: importNote,
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

  return {
    patientId: data.id,
    created: true,
    patientName: `${data.last_name}, ${data.first_name}`,
  };
}

export async function enrichPatientFromDrAppDemographics(
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
  const { data: patient } = await supabase
    .from("patients")
    .select("phone, insurance_provider, insurance_number, birth_date, medical_history")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) return;

  const updates: Record<string, string> = {};
  if (!patient.phone?.trim() && demographics.phone) {
    updates.phone = sanitizeText(demographics.phone);
  }
  if (!patient.insurance_number?.trim() && demographics.insurance_number) {
    updates.insurance_number = sanitizeText(demographics.insurance_number);
  }
  if (!patient.insurance_provider?.trim() && demographics.insurance_provider) {
    updates.insurance_provider = sanitizeText(demographics.insurance_provider);
  }
  if (!patient.birth_date && demographics.birth_date) {
    updates.birth_date = demographics.birth_date;
  }
  if (demographics.chronic_diagnoses.length > 0) {
    const block = demographics.chronic_diagnoses.join("; ");
    const prefix = "Diagnósticos crónicos (import DrApp): ";
    if (!patient.medical_history?.includes(block)) {
      const merged = patient.medical_history?.trim()
        ? `${patient.medical_history.trim()}\n\n${prefix}${block}`
        : `${prefix}${block}`;
      updates.medical_history = sanitizeText(merged);
    }
  }

  if (Object.keys(updates).length === 0) return;

  await supabase.from("patients").update(updates).eq("id", patientId).eq("clinic_id", clinicId);
}

export async function resolveDrAppProfessionalId(
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

export async function insertDrAppClinicalRecords(
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

    const professionalId = await resolveDrAppProfessionalId(
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
      new_values: { source: "drapp_pdf_import", marker: entry.marker },
    });

    created += 1;
  }

  return { created, skipped };
}

