import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { emitStructuredLog } from "@/core/observability/structured-log";

import type {
  MedicalOrderCategory,
  MedicalOrderPriority,
  MedicalOrderStatusV2,
} from "@/features/ordenes-medicas/constants";
import type {
  MedicalOrderCatalogEntry,
  MedicalOrderDetail,
  MedicalOrderFilters,
  MedicalOrderIssuerSnapshot,
  MedicalOrderItem,
  MedicalOrderListRow,
  MedicalOrderPatientSnapshot,
} from "@/features/ordenes-medicas/types";
import { isMissingSchemaError } from "@/features/ordenes-medicas/utils/medical-order-format";

const LEGACY_LIST_COLUMNS =
  "id, patient_id, professional_id, clinical_record_id, status, order_text, order_type, issued_at, created_at";

const V2_LIST_COLUMNS = `${LEGACY_LIST_COLUMNS}, order_category, order_number, priority, valid_until, voided_at, void_reason, diagnosis_text`;

const V2_DETAIL_COLUMNS = `${V2_LIST_COLUMNS}, notes, diagnosis_code, clinical_indication, preparation_instructions, public_verification_token, document_hash, patient_snapshot, issuer_snapshot, voided_by`;

const RELATION_COLUMNS =
  "patients(first_name, last_name, document_number), professionals(display_name, profiles(full_name))";

const MAX_LIST = 200;

type Relations = {
  patients?: { first_name: string | null; last_name: string | null; document_number: string | null } | null;
  professionals?: {
    display_name: string | null;
    profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
  } | null;
};

type RawRow = Record<string, unknown> & Relations;

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function professionalName(row: RawRow): string | null {
  const pro = pickOne(row.professionals);
  if (!pro) return null;
  const profile = pickOne(pro.profiles);
  return pro.display_name?.trim() || profile?.full_name?.trim() || null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function mapListRow(row: RawRow): MedicalOrderListRow {
  const patient = pickOne(row.patients);
  const category = str(row.order_category) as MedicalOrderCategory | null;
  return {
    id: String(row.id),
    patient_id: String(row.patient_id),
    professional_id: String(row.professional_id),
    clinical_record_id: str(row.clinical_record_id),
    status: (str(row.status) ?? "issued") as MedicalOrderStatusV2,
    order_text: str(row.order_text) ?? "",
    order_type: str(row.order_type) ?? "study",
    order_category: category,
    order_number: str(row.order_number),
    priority: str(row.priority) as MedicalOrderPriority | null,
    valid_until: str(row.valid_until),
    issued_at: str(row.issued_at),
    created_at: str(row.created_at) ?? new Date(0).toISOString(),
    voided_at: str(row.voided_at),
    void_reason: str(row.void_reason),
    diagnosis_text: str(row.diagnosis_text),
    patient_name: patient ? `${patient.last_name ?? ""}, ${patient.first_name ?? ""}`.trim() : null,
    patient_document: patient?.document_number ?? null,
    professional_name: professionalName(row),
    isV2: category !== null,
  };
}

function sanitizeSearch(q: string): string {
  return q.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);
}

async function matchingPatientIds(db: SupabaseClient, clinicId: string, q: string): Promise<string[]> {
  const term = `%${q}%`;
  const { data } = await db
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .or(`last_name.ilike.${term},first_name.ilike.${term},document_number.ilike.${term}`)
    .limit(50);
  return (data ?? []).map((r: { id: string }) => r.id);
}

/**
 * Lists medical orders (legacy + v2) for the clinic. RLS scopes rows to clinics the user belongs to;
 * the explicit clinic filter keeps the active clinic context.
 */
export async function queryMedicalOrders(
  db: SupabaseClient,
  clinicId: string,
  filters: MedicalOrderFilters
): Promise<{ rows: MedicalOrderListRow[]; schemaReady: boolean }> {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), MAX_LIST);
  const q = filters.q ? sanitizeSearch(filters.q) : "";
  const patientIdsFromSearch = q ? await matchingPatientIds(db, clinicId, q) : [];

  const build = (columns: string, v2: boolean) => {
    let query = db
      .from("medical_orders")
      .select(`${columns}, ${RELATION_COLUMNS}`)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (filters.patientId) query = query.eq("patient_id", filters.patientId);
    if (filters.professionalId) query = query.eq("professional_id", filters.professionalId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00-03:00`);
    if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59-03:00`);
    if (v2 && filters.category) query = query.eq("order_category", filters.category);
    if (q) {
      const term = `%${q}%`;
      const ors = [`order_text.ilike.${term}`];
      if (v2) ors.push(`order_number.ilike.${term}`, `diagnosis_text.ilike.${term}`);
      if (patientIdsFromSearch.length > 0) ors.push(`patient_id.in.(${patientIdsFromSearch.join(",")})`);
      query = query.or(ors.join(","));
    }
    return query;
  };

  const v2 = await build(V2_LIST_COLUMNS, true);
  if (!v2.error) {
    return { rows: ((v2.data ?? []) as unknown as RawRow[]).map(mapListRow), schemaReady: true };
  }
  if (!isMissingSchemaError(v2.error)) {
    emitStructuredLog({
      level: "error",
      event: "medical_orders.list_failed",
      error_code: v2.error.code ?? null,
    });
    return { rows: [], schemaReady: true };
  }
  if (filters.category) return { rows: [], schemaReady: false };
  const legacy = await build(LEGACY_LIST_COLUMNS, false);
  return {
    rows: legacy.error ? [] : ((legacy.data ?? []) as unknown as RawRow[]).map(mapListRow),
    schemaReady: false,
  };
}

export async function queryMedicalOrderDetail(
  db: SupabaseClient,
  clinicId: string,
  orderId: string
): Promise<MedicalOrderDetail | null> {
  const { data, error } = await db
    .from("medical_orders")
    .select(`${V2_DETAIL_COLUMNS}, ${RELATION_COLUMNS}`)
    .eq("id", orderId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  let row = data as RawRow | null;
  if (error) {
    if (!isMissingSchemaError(error)) return null;
    const legacy = await db
      .from("medical_orders")
      .select(`${LEGACY_LIST_COLUMNS}, notes, ${RELATION_COLUMNS}`)
      .eq("id", orderId)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    row = (legacy.data as RawRow | null) ?? null;
  }
  if (!row) return null;

  const base = mapListRow(row);
  let items: MedicalOrderItem[] = [];
  if (base.isV2) {
    const { data: itemRows } = await db
      .from("medical_order_items")
      .select("id, category, code, name, description, metadata, sort_order")
      .eq("medical_order_id", orderId)
      .eq("clinic_id", clinicId)
      .order("sort_order", { ascending: true });
    items = (itemRows ?? []) as MedicalOrderItem[];
  }

  return {
    ...base,
    notes: str(row.notes),
    diagnosis_code: str(row.diagnosis_code),
    clinical_indication: str(row.clinical_indication),
    preparation_instructions: str(row.preparation_instructions),
    public_verification_token: str(row.public_verification_token),
    document_hash: str(row.document_hash),
    patient_snapshot: (row.patient_snapshot as MedicalOrderPatientSnapshot | null) ?? null,
    issuer_snapshot: (row.issuer_snapshot as MedicalOrderIssuerSnapshot | null) ?? null,
    voided_by: str(row.voided_by),
    items,
  };
}

export async function queryMedicalOrderCatalog(
  db: SupabaseClient,
  clinicId: string
): Promise<MedicalOrderCatalogEntry[]> {
  const { data, error } = await db
    .from("medical_order_catalog")
    .select("id, clinic_id, order_category, group_label, code, name, sort_order")
    .eq("is_active", true)
    .or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
    .order("order_category", { ascending: true })
    .order("sort_order", { ascending: true })
    .limit(1000);
  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    order_category: r.order_category as MedicalOrderCategory,
    group_label: str(r.group_label),
    code: str(r.code),
    name: String(r.name),
  }));
}
