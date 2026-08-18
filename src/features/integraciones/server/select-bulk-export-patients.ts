import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseEntityId } from "@/core/validations/params";

import type { ClinicalExportDateRange } from "@/features/integraciones/lib/clinical-export-sections";

const PAGE = 500;
const PROFESSIONAL_ID_CAP = 8_000;

export type BulkExportPatientRow = {
  id: string;
  last_name: string;
  first_name: string;
  document_number: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  insurance_provider: string | null;
  insurance_plan: string | null;
  insurance_number: string | null;
};

const PATIENT_SELECT =
  "id, last_name, first_name, document_number, birth_date, phone, email, address, insurance_provider, insurance_plan, insurance_number";

async function patientIdsSeenByProfessional(
  supabase: SupabaseClient,
  clinicId: string,
  professionalId: string,
  range: ClinicalExportDateRange
): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  while (ids.size < PROFESSIONAL_ID_CAP) {
    const to = from + PAGE - 1;
    let query = supabase
      .from("clinical_records")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (range.from) query = query.gte("created_at", `${range.from}T00:00:00.000`);
    if (range.to) query = query.lte("created_at", `${range.to}T23:59:59.999`);
    const { data, error } = await query;
    if (error) throw new Error("No se pudieron filtrar pacientes por profesional.");
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (typeof row.patient_id === "string") ids.add(row.patient_id);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

export async function selectBulkExportPatients(
  supabase: SupabaseClient,
  clinicId: string,
  input: {
    scope: "all" | "selected";
    patientIds: string[];
    professionalId: string | null;
    insuranceProvider: string | null;
    range: ClinicalExportDateRange;
    limit: number;
  }
): Promise<{ patients: BulkExportPatientRow[]; truncated: boolean }> {
  const wanted = Math.max(1, input.limit);
  const fetchLimit = wanted + 1;
  let allowedIds: Set<string> | null = null;

  if (input.scope === "selected") {
    allowedIds = new Set<string>();
    for (const raw of input.patientIds) {
      const parsed = parseEntityId(raw, "Paciente");
      if (parsed.ok) allowedIds.add(parsed.data);
    }
    if (allowedIds.size === 0) return { patients: [], truncated: false };
  }

  if (input.professionalId) {
    const parsed = parseEntityId(input.professionalId, "Profesional");
    if (!parsed.ok) throw new Error(parsed.error);
    const seen = await patientIdsSeenByProfessional(supabase, clinicId, parsed.data, input.range);
    allowedIds = allowedIds
      ? new Set([...allowedIds].filter((id) => seen.has(id)))
      : seen;
    if (allowedIds.size === 0) return { patients: [], truncated: false };
  }

  const rows: BulkExportPatientRow[] = [];

  if (allowedIds) {
    const list = [...allowedIds];
    for (let i = 0; i < list.length && rows.length < fetchLimit; i += 100) {
      const chunk = list.slice(i, i + 100);
      let query = supabase
        .from("patients")
        .select(PATIENT_SELECT)
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .in("id", chunk)
        .order("last_name");
      if (input.insuranceProvider) {
        query = query.eq("insurance_provider", input.insuranceProvider);
      }
      const { data, error } = await query;
      if (error) throw new Error("No se pudieron leer los pacientes.");
      rows.push(...((data ?? []) as BulkExportPatientRow[]));
    }
    rows.sort((a, b) => a.last_name.localeCompare(b.last_name, "es"));
    return {
      patients: rows.slice(0, wanted),
      truncated: rows.length > wanted,
    };
  }

  let from = 0;
  while (rows.length < fetchLimit) {
    const to = from + PAGE - 1;
    let query = supabase
      .from("patients")
      .select(PATIENT_SELECT)
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("last_name")
      .range(from, to);
    if (input.insuranceProvider) {
      query = query.eq("insurance_provider", input.insuranceProvider);
    }
    const { data, error } = await query;
    if (error) throw new Error("No se pudieron leer los pacientes.");
    if (!data || data.length === 0) break;
    rows.push(...(data as BulkExportPatientRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return {
    patients: rows.slice(0, wanted),
    truncated: rows.length > wanted,
  };
}
