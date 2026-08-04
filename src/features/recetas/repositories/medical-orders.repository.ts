import type { MedicalOrder } from "@/types/medical-order";
import type { DbClient, RepoResult } from "@/core/repositories/types";
import { mapDbError, repoErr, repoOk } from "@/core/repositories/types";

export type MedicalOrderInsertRow = {
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  clinical_record_id: string | null;
  order_text: string;
  notes: string | null;
  order_type: string;
  status: string;
  issued_at: string;
  created_by: string;
};

const MEDICAL_ORDER_DB_HINTS: Record<string, string> = {
  medical_orders:
    "Falta la migración 015 en Supabase (órdenes médicas y turnos online).",
  "schema cache":
    "Falta la migración 015 en Supabase (órdenes médicas y turnos online).",
};

export function formatMedicalOrderDbError(message: string): string {
  return mapDbError(message, MEDICAL_ORDER_DB_HINTS);
}

export async function insertMedicalOrder(
  db: DbClient,
  row: MedicalOrderInsertRow
): Promise<RepoResult<MedicalOrder>> {
  const { data, error } = await db.from("medical_orders").insert(row).select().single();
  if (error) return repoErr(formatMedicalOrderDbError(error.message));
  return repoOk(data as MedicalOrder);
}

export async function voidMedicalOrderRow(
  db: DbClient,
  orderId: string,
  clinicId: string
): Promise<RepoResult<void>> {
  const { error } = await db
    .from("medical_orders")
    .update({ status: "void", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("clinic_id", clinicId);

  if (error) return repoErr(error.message);
  return repoOk(undefined);
}
