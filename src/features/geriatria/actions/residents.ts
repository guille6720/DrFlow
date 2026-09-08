"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { logAudit } from "@/core/auth/session.actions";
import { hasProduct } from "@/core/products/product-access";
import { PRODUCTS } from "@/core/products/products";
import { loadClinicProducts } from "@/core/products/products.server";
import { asStagingSchemaClient } from "@/core/products/staging-schema-client";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

export type AdmitResidentResult =
  | { ok: true; residentId: string }
  | { ok: false; error: string };

async function requireGeriatricsWrite() {
  const access = await requireClinicPermission("managePatients");
  if (!access.ok) return { ok: false as const, error: access.error };

  const products = await loadClinicProducts(access.clinicId);
  if (!hasProduct(products, PRODUCTS.GERIATRICS)) {
    return { ok: false as const, error: "El producto Geriatría no está habilitado." };
  }
  return {
    ok: true as const,
    clinicId: access.clinicId,
    userId: access.userId,
  };
}

export async function admitPatientAsResident(formData: FormData): Promise<AdmitResidentResult> {
  const access = await requireGeriatricsWrite();
  if (!access.ok) return { ok: false, error: access.error };

  const patientIdParsed = parseEntityId(String(formData.get("patient_id") ?? ""), "Paciente");
  if (!patientIdParsed.ok) return { ok: false, error: patientIdParsed.error };
  const patientId = patientIdParsed.data;

  const admissionDateRaw = String(formData.get("admission_date") ?? "").trim();
  const admissionDate = admissionDateRaw || new Date().toISOString().slice(0, 10);

  const bedIdRaw = String(formData.get("bed_id") ?? "").trim();
  const bedId = bedIdRaw || null;

  const dependencyLevel = String(formData.get("dependency_level") ?? "").trim() || null;
  const mobility = String(formData.get("mobility") ?? "").trim() || null;
  const diet = String(formData.get("diet") ?? "").trim() || null;
  const observations = String(formData.get("observations") ?? "").trim() || null;
  const clinicalAlerts = String(formData.get("clinical_alerts") ?? "").trim() || null;
  const coverage = String(formData.get("coverage") ?? "").trim() || null;

  const typed = await createClient();
  const db = asStagingSchemaClient(typed);

  const { data: patient, error: patientError } = await typed
    .from("patients")
    .select("id, first_name, last_name, document_number, clinic_id")
    .eq("id", patientId)
    .eq("clinic_id", access.clinicId)
    .maybeSingle();

  if (patientError || !patient) {
    return { ok: false, error: "Paciente no encontrado en esta institución." };
  }

  const { data: existing } = await db
    .from("geriatrics_residents")
    .select("id, status")
    .eq("clinic_id", access.clinicId)
    .eq("patient_id", patientId);

  const activeExisting = (existing ?? []).find((r) => {
    const status = String(r.status ?? "");
    return status !== "egresado" && status !== "fallecido";
  });
  if (activeExisting) {
    return {
      ok: false,
      error: "Esta persona ya es residente activo (o en ausencia/hospitalización).",
    };
  }

  if (bedId) {
    const { data: bedRows } = await db
      .from("geriatrics_beds")
      .select("id, status")
      .eq("id", bedId)
      .eq("clinic_id", access.clinicId);
    const bed = bedRows?.[0];
    if (!bed) return { ok: false, error: "Cama no encontrada." };
    if (String(bed.status) !== "libre") {
      return { ok: false, error: "La cama seleccionada no está libre." };
    }
  }

  const { data: inserted, error: insertError } = await db
    .from("geriatrics_residents")
    .insert({
      clinic_id: access.clinicId,
      patient_id: patientId,
      status: "activo",
      admission_date: admissionDate,
      bed_id: bedId,
      dependency_level: dependencyLevel,
      mobility,
      diet,
      coverage,
      observations,
      clinical_alerts: clinicalAlerts,
      created_by: access.userId,
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    if (insertError?.code === "23505") {
      return { ok: false, error: "Esta persona ya tiene ficha de residente." };
    }
    return { ok: false, error: insertError?.message ?? "No se pudo crear el residente." };
  }

  const residentId = String(inserted.id);

  await db.from("geriatrics_resident_status_history").insert({
    clinic_id: access.clinicId,
    resident_id: residentId,
    from_status: null,
    to_status: "activo",
    changed_by: access.userId,
    reason: "ingreso",
  });

  if (bedId) {
    await db.from("geriatrics_bed_assignments").insert({
      clinic_id: access.clinicId,
      resident_id: residentId,
      bed_id: bedId,
      assigned_by: access.userId,
      reason: "ingreso",
    });
    await db
      .from("geriatrics_beds")
      .update({ status: "ocupada", updated_at: new Date().toISOString() })
      .eq("id", bedId)
      .eq("clinic_id", access.clinicId);
  }

  await logAudit({
    clinicId: access.clinicId,
    module: "geriatrics",
    what: "Ingreso de residente",
    entityType: "geriatrics_resident",
    entityId: residentId,
    patientId,
    action: "create",
    newValues: {
      resident_id: residentId,
      patient_id: patientId,
      status: "activo",
      admission_date: admissionDate,
      bed_id: bedId,
      patient_name: `${patient.last_name}, ${patient.first_name}`,
    },
  });

  revalidatePath("/geriatria");
  revalidatePath("/geriatria/residentes");
  revalidatePath("/geriatria/habitaciones");

  return { ok: true, residentId };
}
