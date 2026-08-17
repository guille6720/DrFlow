import { isUniqueViolation } from "@/core/errors/postgres-error";
import type { DbClient, RepoResult } from "@/core/repositories/types";
import { mapPostgresError, repoErr, repoOk } from "@/core/repositories/types";
import { MEDICAL_ORDER_IDEMPOTENCY_COLUMNS } from "@/core/supabase/select-columns";

import {
  MEDICAL_ORDER_CONCURRENCY_ERROR,
  MEDICAL_ORDER_IDEMPOTENCY_CONFLICT,
  MEDICAL_ORDER_VOIDED_ERROR,
} from "@/features/recetas/repositories/medical-orders.errors";

import type { MedicalOrder } from "@/types/medical-order";

export type MedicalOrderInsertRow = {
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  clinical_record_id: string | null;
  order_text: string;
  notes: string | null;
  order_type: string;
  status: string;
  created_by: string;
  idempotency_key?: string | null;
};

const MEDICAL_ORDER_DB_HINTS: Record<string, string> = {};

export function formatMedicalOrderDbError(error: { message?: string; code?: string; details?: string; hint?: string }): string {
  return mapPostgresError(error, MEDICAL_ORDER_DB_HINTS);
}

export async function getMedicalOrderVersionRow(
  db: DbClient,
  orderId: string,
  clinicId: string
): Promise<RepoResult<{ version: number; status: MedicalOrder["status"] }>> {
  const { data, error } = await db
    .from("medical_orders")
    .select("version, status")
    .eq("id", orderId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) return repoErr(formatMedicalOrderDbError(error));
  if (!data) return repoErr("Orden no encontrada.");
  return repoOk({
    version: typeof data.version === "number" ? data.version : 1,
    status: data.status as MedicalOrder["status"],
  });
}

async function resolveMedicalOrderWriteConflict(
  db: DbClient,
  orderId: string,
  clinicId: string
): Promise<string> {
  const current = await getMedicalOrderVersionRow(db, orderId, clinicId);
  if (!current.ok) return current.error;
  if (current.data.status !== "issued") return MEDICAL_ORDER_VOIDED_ERROR;
  return MEDICAL_ORDER_CONCURRENCY_ERROR;
}

export async function findMedicalOrderByIdempotencyKey(
  db: DbClient,
  clinicId: string,
  idempotencyKey: string
): Promise<RepoResult<MedicalOrder | null>> {
  const { data, error } = await db
    .from("medical_orders")
    .select(MEDICAL_ORDER_IDEMPOTENCY_COLUMNS)
    .eq("clinic_id", clinicId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) return repoErr(formatMedicalOrderDbError(error));
  return repoOk((data as MedicalOrder | null) ?? null);
}

export async function insertMedicalOrder(
  db: DbClient,
  row: MedicalOrderInsertRow
): Promise<RepoResult<MedicalOrder>> {
  const { data, error } = await db.from("medical_orders").insert(row).select(MEDICAL_ORDER_IDEMPOTENCY_COLUMNS).single();
  if (error) {
    if (isUniqueViolation(error)) {
      return repoErr(MEDICAL_ORDER_IDEMPOTENCY_CONFLICT);
    }
    return repoErr(formatMedicalOrderDbError(error));
  }
  return repoOk(data as MedicalOrder);
}

export type MedicalOrderUpdateRow = {
  order_text: string;
  notes: string | null;
  order_type: string;
  professional_id: string;
};

export async function updateMedicalOrderRow(
  db: DbClient,
  orderId: string,
  clinicId: string,
  expectedVersion: number,
  patch: MedicalOrderUpdateRow
): Promise<RepoResult<MedicalOrder>> {
  const { data, error } = await db
    .from("medical_orders")
    .update({
      ...patch,
      version: expectedVersion + 1,
    })
    .eq("id", orderId)
    .eq("clinic_id", clinicId)
    .eq("status", "issued")
    .eq("version", expectedVersion)
    .select(MEDICAL_ORDER_IDEMPOTENCY_COLUMNS)
    .maybeSingle();

  if (error) return repoErr(formatMedicalOrderDbError(error));
  if (!data) {
    return repoErr(await resolveMedicalOrderWriteConflict(db, orderId, clinicId));
  }
  return repoOk(data as MedicalOrder);
}

export async function voidMedicalOrderRow(
  db: DbClient,
  orderId: string,
  clinicId: string,
  expectedVersion: number
): Promise<RepoResult<void>> {
  const { data, error } = await db
    .from("medical_orders")
    .update({
      status: "void",
      version: expectedVersion + 1,
    })
    .eq("id", orderId)
    .eq("clinic_id", clinicId)
    .eq("status", "issued")
    .eq("version", expectedVersion)
    .select("id")
    .maybeSingle();

  if (error) return repoErr(formatMedicalOrderDbError(error));
  if (!data) {
    return repoErr(await resolveMedicalOrderWriteConflict(db, orderId, clinicId));
  }
  return repoOk(undefined);
}
