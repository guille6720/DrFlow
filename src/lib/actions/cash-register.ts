"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { getSession, logAudit } from "@/core/auth/session";
import { createClient } from "@/core/supabase/server";
import {
  cashClosureSchema,
  createCashChargeSchema,
  ledgerEntrySchema,
  voidCashChargeSchema,
} from "@/core/validations/cash-schemas";
import { firstZodIssue, parseEntityId } from "@/core/validations/params";

import { isBlockedChargeKind, labelForChargeKind } from "@/lib/constants/cash-register";

export async function createCashCharge(formData: FormData) {
  const access = await requireClinicPermission("manageCashRegister");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  const raw = Object.fromEntries(formData.entries());
  const parsed = createCashChargeSchema.safeParse(raw);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const kindLabel = labelForChargeKind(parsed.data.charge_kind);
  if (isBlockedChargeKind(kindLabel)) {
    return { error: "Tipo de cobro no autorizado." };
  }

  const supabase = await createClient();
  const { data: charge, error } = await supabase.rpc("create_cash_charge_atomic", {
    p_clinic_id: clinicId,
    p_patient_id: parsed.data.patient_id,
    p_professional_id: parsed.data.professional_id || null,
    p_appointment_id: parsed.data.appointment_id || null,
    p_charge_kind: parsed.data.charge_kind,
    p_attention_type: parsed.data.attention_type,
    p_payment_method: parsed.data.payment_method,
    p_motive: parsed.data.motive?.trim() || kindLabel,
    p_amount: parsed.data.amount,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes?.trim() || null,
    p_created_by: user?.id ?? null,
  });

  if (error) {
    if (error.message.includes("CAJA_MODULE_NOT_INSTALLED")) {
      return { error: "El módulo de caja no está instalado. Aplicá la migración 034." };
    }
    return { error: error.message };
  }

  const row = charge as { id: string };
  await logAudit({
    clinicId,
    entityType: "cash_charge",
    entityId: row.id,
    action: "create",
    metadata: { amount: parsed.data.amount, method: parsed.data.payment_method },
  });

  revalidatePath("/caja");
  revalidatePath("/caja/reportes");
  return { data: charge };
}

export async function voidCashCharge(formData: FormData) {
  const access = await requireClinicPermission("manageCashRegister");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  const raw = Object.fromEntries(formData.entries());
  const parsed = voidCashChargeSchema.safeParse(raw);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_cash_charge_atomic", {
    p_clinic_id: clinicId,
    p_charge_id: parsed.data.charge_id,
    p_reason: parsed.data.reason,
    p_updated_by: user?.id ?? null,
  });

  if (error) {
    if (error.message.includes("CHARGE_NOT_FOUND")) return { error: "Cobro no encontrado" };
    if (error.message.includes("ALREADY_VOIDED")) return { error: "El cobro ya está anulado" };
    if (error.message.includes("CAJA_MODULE_NOT_INSTALLED")) {
      return { error: "El módulo de caja no está instalado. Aplicá la migración 034." };
    }
    return { error: error.message };
  }

  await logAudit({
    clinicId,
    entityType: "cash_charge",
    entityId: parsed.data.charge_id,
    action: "update",
    metadata: { void: true, reason: parsed.data.reason },
  });

  revalidatePath("/caja");
  return { success: true };
}

export async function addLedgerEntry(formData: FormData) {
  const access = await requireClinicPermission("manageCashRegister");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  const parsed = ledgerEntrySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };
  if (parsed.data.debit <= 0 && parsed.data.credit <= 0) {
    return { error: "Ingresá debe o haber" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_patient_ledger_entry_atomic", {
    p_clinic_id: clinicId,
    p_patient_id: parsed.data.patient_id,
    p_professional_id: parsed.data.professional_id || null,
    p_concept: parsed.data.concept,
    p_debit: parsed.data.debit,
    p_credit: parsed.data.credit,
    p_notes: parsed.data.notes?.trim() || null,
    p_created_by: user?.id ?? null,
  });

  if (error) {
    if (error.message.includes("CAJA_MODULE_NOT_INSTALLED")) {
      return { error: "El módulo de caja no está instalado. Aplicá la migración 034." };
    }
    return { error: error.message };
  }

  const row = data as { id: string };
  await logAudit({
    clinicId,
    entityType: "patient_ledger",
    entityId: row.id,
    action: "create",
  });

  revalidatePath(`/caja/cuenta-corriente/${parsed.data.patient_id}`);
  return { data };
}

export async function closeDailyCash(formData: FormData) {
  const access = await requireClinicPermission("manageCashRegister");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  const parsed = cashClosureSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const supabase = await createClient();
  const dayStart = `${parsed.data.closure_date}T00:00:00.000Z`;
  const dayEnd = `${parsed.data.closure_date}T23:59:59.999Z`;

  const { data: charges } = await supabase
    .from("cash_charges")
    .select("amount, payment_method, attention_type, charge_kind, status, patient_id")
    .eq("clinic_id", clinicId)
    .eq("status", "collected")
    .gte("charged_at", dayStart)
    .lte("charged_at", dayEnd);

  const rows = charges ?? [];
  const totals: Record<string, number> = {
    cash: 0,
    debit: 0,
    credit: 0,
    transfer: 0,
    mercadopago: 0,
    qr: 0,
    account: 0,
    particular: 0,
    copago: 0,
    coseguro: 0,
    art: 0,
    obra_social: 0,
    general: 0,
  };

  const patients = new Set<string>();
  for (const c of rows) {
    patients.add(c.patient_id);
    const amt = Number(c.amount);
    totals.general += amt;
    if (c.payment_method in totals) totals[c.payment_method] += amt;
    if (c.charge_kind === "consulta_particular") totals.particular += amt;
    if (c.charge_kind === "copago_autorizado") totals.copago += amt;
    if (c.charge_kind === "coseguro_autorizado") totals.coseguro += amt;
    if (c.attention_type === "art") totals.art += amt;
    if (c.attention_type === "obra_social") totals.obra_social += amt;
  }

  const { data, error } = await supabase
    .from("cash_daily_closures")
    .upsert(
      {
        clinic_id: clinicId,
        closure_date: parsed.data.closure_date,
        totals,
        patient_count: patients.size,
        consultation_count: rows.length,
        cash_difference: parsed.data.cash_difference,
        notes: parsed.data.notes?.trim() || null,
        closed_by: user?.id,
        closed_at: new Date().toISOString(),
      },
      { onConflict: "clinic_id,closure_date" }
    )
    .select()
    .single();

  if (error) return { error: error.message };

  await logAudit({
    clinicId,
    entityType: "cash_closure",
    entityId: data.id,
    action: "create",
    metadata: { date: parsed.data.closure_date, total: totals.general },
  });

  revalidatePath("/caja/cierre");
  return { data };
}

export async function prepareCashInvoice(chargeId: string) {
  const access = await requireClinicPermission("manageCashRegister");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  const idParsed = parseEntityId(chargeId, "Cobro");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data: charge } = await supabase
    .from("cash_charges")
    .select("id, patient_id, amount, status")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!charge || charge.status !== "collected") {
    return { error: "Solo se puede facturar un cobro confirmado" };
  }

  const { data, error } = await supabase
    .from("cash_invoices")
    .insert({
      clinic_id: clinicId,
      cash_charge_id: charge.id,
      patient_id: charge.patient_id,
      amount: charge.amount,
      status: "draft",
      notes: "Preparado para integración AFIP/ARCA",
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}
