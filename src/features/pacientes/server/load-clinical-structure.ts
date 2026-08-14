import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ClinicalDiagnosisEntry,
  ClinicalTreatmentEntry,
} from "@/features/historias/utils/clinical-structured-entries";

export type PatientProblemListItem = {
  id: string;
  name: string;
  cie10_code: string | null;
  status: string;
  noted_at: string;
  source_clinical_record_id: string | null;
};

type RawDiagnosisChild = {
  id: string;
  clinical_record_id: string;
  name: string;
  cie10_code: string | null;
  pathology_id: string | null;
  is_chronic: boolean;
  sort_order: number;
};

type RawTreatmentChild = {
  id: string;
  clinical_record_id: string;
  product: string;
  dose: string | null;
  frequency: string | null;
  notes: string | null;
  status: string | null;
  quantity: number | null;
  vademecum_code: string | null;
  catalog_source: string | null;
  active_ingredient: string | null;
  sort_order: number;
};

export async function loadClinicalRecordChildrenForPatient(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  recordIds: string[]
): Promise<{
  diagnosesByRecord: Map<string, ClinicalDiagnosisEntry[]>;
  treatmentsByRecord: Map<string, ClinicalTreatmentEntry[]>;
}> {
  const diagnosesByRecord = new Map<string, ClinicalDiagnosisEntry[]>();
  const treatmentsByRecord = new Map<string, ClinicalTreatmentEntry[]>();
  if (recordIds.length === 0) {
    return { diagnosesByRecord, treatmentsByRecord };
  }

  const [{ data: diagnoses, error: diagnosesError }, { data: treatments, error: treatmentsError }] =
    await Promise.all([
      supabase
        .from("clinical_record_diagnoses")
        .select(
          "id, clinical_record_id, name, cie10_code, pathology_id, is_chronic, sort_order"
        )
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .in("clinical_record_id", recordIds)
        .order("sort_order", { ascending: true }),
      supabase
        .from("clinical_record_treatments")
        .select(
          "id, clinical_record_id, product, dose, frequency, notes, status, quantity, vademecum_code, catalog_source, active_ingredient, sort_order"
        )
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .in("clinical_record_id", recordIds)
        .order("sort_order", { ascending: true }),
    ]);

  if (!diagnosesError) {
    for (const row of (diagnoses ?? []) as RawDiagnosisChild[]) {
      const list = diagnosesByRecord.get(row.clinical_record_id) ?? [];
      list.push({
        name: row.name,
        cie10_code: row.cie10_code,
        pathology_id: row.pathology_id,
        is_chronic: row.is_chronic,
      });
      diagnosesByRecord.set(row.clinical_record_id, list);
    }
  }

  if (!treatmentsError) {
    for (const row of (treatments ?? []) as RawTreatmentChild[]) {
      const list = treatmentsByRecord.get(row.clinical_record_id) ?? [];
      list.push({
        product: row.product,
        dose: row.dose ?? undefined,
        frequency: row.frequency ?? undefined,
        notes: row.notes ?? undefined,
        status: row.status ?? "Actual",
        quantity: row.quantity ?? undefined,
        vademecum_code: row.vademecum_code,
        catalog_source: row.catalog_source,
        active_ingredient: row.active_ingredient,
      });
      treatmentsByRecord.set(row.clinical_record_id, list);
    }
  }

  return { diagnosesByRecord, treatmentsByRecord };
}

export async function loadPatientProblemList(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string
): Promise<PatientProblemListItem[]> {
  const { data, error } = await supabase
    .from("patient_problem_list")
    .select("id, name, cie10_code, status, noted_at, source_clinical_record_id")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .eq("status", "active")
    .order("noted_at", { ascending: false })
    .limit(40);

  if (error) return [];
  return (data ?? []) as PatientProblemListItem[];
}

export function attachStructuredChildrenToRecords<
  T extends { id: string; diagnoses_json?: unknown; treatments_json?: unknown },
>(
  records: T[],
  diagnosesByRecord: Map<string, ClinicalDiagnosisEntry[]>,
  treatmentsByRecord: Map<string, ClinicalTreatmentEntry[]>
): Array<
  T & {
    diagnoses_rows: ClinicalDiagnosisEntry[];
    treatments_rows: ClinicalTreatmentEntry[];
  }
> {
  return records.map((r) => ({
    ...r,
    diagnoses_rows: diagnosesByRecord.get(r.id) ?? [],
    treatments_rows: treatmentsByRecord.get(r.id) ?? [],
  }));
}
