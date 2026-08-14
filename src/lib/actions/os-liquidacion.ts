"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { logAudit } from "@/core/auth/session.actions";
import { getSession } from "@/core/auth/session.server";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { createClient } from "@/core/supabase/server";
import {
  createOsLiquidationBatchSchema,
  deleteOsFeeScheduleSchema,
  osFeeScheduleSchema,
  updateOsLiquidationStatusSchema,
} from "@/core/validations/os-liquidacion-schemas";
import { firstZodIssue, parseEntityId } from "@/core/validations/params";

export async function upsertOsFeeSchedule(formData: FormData) {
  const access = await requireClinicPermission("manageCashRegister");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const raw = Object.fromEntries(formData.entries());
  const parsed = osFeeScheduleSchema.safeParse(raw);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("os_fee_schedules").upsert(
    {
      clinic_id: clinicId,
      insurance_provider: parsed.data.insurance_provider.trim(),
      practice_code: parsed.data.practice_code,
      practice_label: parsed.data.practice_label,
      amount: parsed.data.amount,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id,insurance_provider,practice_code" }
  );

  if (error) return { error: error.message };

  revalidatePath("/facturacion/tarifas");
  revalidatePath("/facturacion/liquidacion");
  return { success: true };
}

export async function deleteOsFeeSchedule(formData: FormData) {
  const access = await requireClinicPermission("manageCashRegister");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const raw = Object.fromEntries(formData.entries());
  const parsed = deleteOsFeeScheduleSchema.safeParse(raw);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("os_fee_schedules")
    .delete()
    .eq("id", parsed.data.id)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidatePath("/facturacion/tarifas");
  return { success: true };
}

export async function createOsLiquidationBatch(formData: FormData) {
  const access = await requireClinicPermission("manageCashRegister");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  const raw = Object.fromEntries(formData.entries());
  const parsed = createOsLiquidationBatchSchema.safeParse(raw);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const periodFrom = new Date(parsed.data.period_from);
  periodFrom.setHours(0, 0, 0, 0);
  const periodTo = new Date(parsed.data.period_to);
  periodTo.setDate(periodTo.getDate() + 1);
  periodTo.setHours(0, 0, 0, 0);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_os_liquidation_batch", {
    p_clinic_id: clinicId,
    p_insurance_provider: parsed.data.insurance_provider.trim(),
    p_period_from: periodFrom.toISOString(),
    p_period_to: periodTo.toISOString(),
    p_created_by: user?.id ?? null,
  });

  if (error) {
    return { error: resolvePostgresUserMessage(error, { fallback: error.message }) };
  }

  const result = data as { batch_id?: string; item_count?: number; total_amount?: number };
  if (!result.batch_id) return { error: "No se pudo crear el lote." };

  await logAudit({
    clinicId,
    entityType: "os_liquidation_batch",
    entityId: result.batch_id,
    action: "create",
    metadata: {
      provider: parsed.data.insurance_provider,
      item_count: result.item_count,
    },
  });

  revalidatePath("/facturacion/liquidacion");
  return { success: true, batchId: result.batch_id, itemCount: result.item_count ?? 0 };
}

export async function updateOsLiquidationBatchStatus(formData: FormData) {
  const access = await requireClinicPermission("manageCashRegister");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const raw = Object.fromEntries(formData.entries());
  const parsed = updateOsLiquidationStatusSchema.safeParse(raw);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_os_liquidation_batch_status", {
    p_clinic_id: clinicId,
    p_batch_id: parsed.data.batch_id,
    p_status: parsed.data.status,
  });

  if (error) {
    return { error: resolvePostgresUserMessage(error, { fallback: error.message }) };
  }

  await logAudit({
    clinicId,
    entityType: "os_liquidation_batch",
    entityId: parsed.data.batch_id,
    action: "update",
    metadata: { status: parsed.data.status },
  });

  revalidatePath("/facturacion/liquidacion");
  revalidatePath(`/facturacion/liquidacion/${parsed.data.batch_id}`);
  return { success: true };
}

export async function updateOsLiquidationNotes(batchId: string, notes: string) {
  const access = await requireClinicPermission("manageCashRegister");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const idParsed = parseEntityId(batchId, "Lote");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("os_liquidation_batches")
    .update({ notes: notes.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidatePath(`/facturacion/liquidacion/${idParsed.data}`);
  return { success: true };
}
