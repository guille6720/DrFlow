import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeText } from "@/lib/validations/schemas";
import type { ExtractedPatientInfo } from "@/lib/utils/pdf-patient-extract";

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text ?? "";
  } catch {
    return "";
  }
}

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
