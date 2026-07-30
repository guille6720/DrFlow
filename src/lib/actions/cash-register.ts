"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, logAudit } from "@/lib/auth/session";
import { requireClinicPermission } from "@/lib/actions/clinic-guard";
import {
  createCashChargeSchema,
  voidCashChargeSchema,
  ledgerEntrySchema,
  cashClosureSchema,
} from "@/lib/validations/cash-schemas";
import { isBlockedChargeKind, labelForChargeKind } from "@/lib/constants/cash-register";

async function getPatientLedgerBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  patientId: string
): Promise<number> {
  const { data } = await supabase
    .from("patient_ledger_entries")
    .select("balance_after")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("entry_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.balance_after != null ? Number(data.balance_after) : 0;
}

export async function createCashCharge(formData: FormData) {
  const access = await requireClinicPermission("manageCashRegister");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  const raw = Object.fromEntries(formData.entries());
  const parsed = createCashChargeSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const kindLabel = labelForChargeKind(parsed.data.charge_kind);
  if (isBlockedChargeKind(kindLabel)) {
    return { error: "Tipo de cobro no autorizado." };
  }

  const supabase = await createClient();
  const { data: charge, error } = await supabase
    .from("cash_charges")
    .insert({
      clinic_id: clinicId,
      patient_id: parsed.data.patient_id,
      professional_id: parsed.data.professional_id || null,
      appointment_id: parsed.data.appointment_id || null,
      charge_kind: parsed.data.charge_kind,
      attention_type: parsed.data.attention_type,
      payment_method: parsed.data.payment_method,
      motive: parsed.data.motive?.trim() || kindLabel,
      amount: parsed.data.amount,
      status: parsed.data.status,
      notes: parsed.data.notes?.trim() || null,
      created_by: user?.id,
      updated_by: user?.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (parsed.data.payment_method === "account" && parsed.data.status === "collected") {
    const prev = await getPatientLedgerBalance(supabase, clinicId, parsed.data.patient_id);
    const debit = parsed.data.amount;
    await supabase.from("patient_ledger_entries").insert({
      clinic_id: clinicId,
      patient_id: parsed.data.patient_id,
      professional_id: parsed.data.professional_id || null,
      cash_charge_id: charge.id,
      concept: parsed.data.motive?.trim() || kindLabel,
      debit,
      credit: 0,
      balance_after: prev + debit,
      notes: parsed.data.notes?.trim() || null,
      created_by: user?.id,
    });
  }

  await logAudit({
    clinicId,
    entityType: "cash_charge",
    entityId: charge.id,
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
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("cash_charges")
    .select("*")
    .eq("id", parsed.data.charge_id)
    .eq("clinic_id", clinicId)
    .single();

  if (fetchErr || !existing) return { error: "Cobro no encontrado" };
  if (existing.status === "voided") return { error: "El cobro ya está anulado" };

  const { error } = await supabase
    .from("cash_charges")
    .update({
      status: "voided",
      voided_at: new Date().toISOString(),
      void_reason: parsed.data.reason,
      updated_by: user?.id,
    })
    .eq("id", parsed.data.charge_id)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  if (existing.payment_method === "account") {
    const prev = await getPatientLedgerBalance(supabase, clinicId, existing.patient_id);
    const credit = Number(existing.amount);
    await supabase.from("patient_ledger_entries").insert({
      clinic_id: clinicId,
      patient_id: existing.patient_id,
      professional_id: existing.professional_id,
      cash_charge_id: existing.id,
      concept: `Anulación: ${parsed.data.reason}`,
      debit: 0,
      credit,
      balance_after: Math.max(0, prev - credit),
      created_by: user?.id,
    });
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
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data.debit <= 0 && parsed.data.credit <= 0) {
    return { error: "Ingresá debe o haber" };
  }

  const supabase = await createClient();
  const prev = await getPatientLedgerBalance(supabase, clinicId, parsed.data.patient_id);
  const balance_after = prev + parsed.data.debit - parsed.data.credit;

  const { data, error } = await supabase
    .from("patient_ledger_entries")
    .insert({
      clinic_id: clinicId,
      patient_id: parsed.data.patient_id,
      professional_id: parsed.data.professional_id || null,
      concept: parsed.data.concept,
      debit: parsed.data.debit,
      credit: parsed.data.credit,
      balance_after,
      notes: parsed.data.notes?.trim() || null,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await logAudit({
    clinicId,
    entityType: "patient_ledger",
    entityId: data.id,
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
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

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

  const supabase = await createClient();
  const { data: charge } = await supabase
    .from("cash_charges")
    .select("id, patient_id, amount, status")
    .eq("id", chargeId)
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
