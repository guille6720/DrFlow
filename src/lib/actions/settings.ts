"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinic, getActiveClinicId, getSession, logAudit } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { z } from "zod";

async function requireAdmin() {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "manageSettings", isSuperadmin)) {
    return { error: "Sin permisos", clinicId: null as string | null };
  }
  return { clinicId, error: null };
}

export async function updateClinicSettings(formData: FormData) {
  const { clinicId, error: permErr } = await requireAdmin();
  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinics")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      default_appointment_duration: parseInt(
        String(formData.get("default_appointment_duration") ?? "30"),
        10
      ),
    })
    .eq("id", clinicId);

  if (error) return { error: error.message };
  revalidatePath("/configuracion");
  revalidatePath("/agenda");
  return { success: true };
}

export async function createSpecialty(name: string) {
  const { clinicId, error: permErr } = await requireAdmin();
  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };
  if (!name.trim()) return { error: "Nombre requerido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("specialties")
    .insert({ clinic_id: clinicId, name: name.trim() });
  if (error) return { error: error.message };
  revalidatePath("/configuracion");
  return { success: true };
}

export async function deleteSpecialty(id: string) {
  const { clinicId, error: permErr } = await requireAdmin();
  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("specialties")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId);
  if (error) return { error: error.message };
  revalidatePath("/configuracion");
  return { success: true };
}

export async function createLocation(name: string, address?: string) {
  const { clinicId, error: permErr } = await requireAdmin();
  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };
  if (!name.trim()) return { error: "Nombre requerido" };

  const supabase = await createClient();
  const { error } = await supabase.from("locations").insert({
    clinic_id: clinicId,
    name: name.trim(),
    address: address?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/configuracion");
  return { success: true };
}

export async function deleteLocation(id: string) {
  const { clinicId, error: permErr } = await requireAdmin();
  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId);
  if (error) return { error: error.message };
  revalidatePath("/configuracion");
  return { success: true };
}

export async function createConsultationReason(name: string) {
  const { clinicId, error: permErr } = await requireAdmin();
  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };
  if (!name.trim()) return { error: "Nombre requerido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("consultation_reasons")
    .insert({ clinic_id: clinicId, name: name.trim() });
  if (error) return { error: error.message };
  revalidatePath("/configuracion");
  return { success: true };
}

export async function createProfessional(formData: FormData) {
  const { clinicId, error: permErr } = await requireAdmin();
  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };

  const user = await getSession();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const specialtyId = String(formData.get("specialty_id") ?? "") || null;
  const userId = String(formData.get("user_id") ?? "") || user?.id || null;

  if (!displayName) return { error: "Nombre del profesional requerido" };

  const supabase = await createClient();
  const { error } = await supabase.from("professionals").insert({
    clinic_id: clinicId,
    user_id: userId,
    specialty_id: specialtyId,
    display_name: displayName,
    license_number: String(formData.get("license_number") ?? "").trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/configuracion");
  revalidatePath("/agenda");
  return { success: true };
}

export async function enablePublicBooking() {
  const { clinicId, error: permErr } = await requireAdmin();
  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };

  const supabase = await createClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("slug")
    .eq("id", clinicId)
    .single();
  if (!clinic) return { error: "Clínica no encontrada" };

  const { data: pro } = await supabase
    .from("professionals")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("public_booking_links").upsert(
    {
      clinic_id: clinicId,
      slug: clinic.slug,
      professional_id: pro?.id ?? null,
      is_active: true,
    },
    { onConflict: "slug" }
  );
  if (error) return { error: error.message };
  revalidatePath("/configuracion");
  revalidatePath("/agenda");
  return { success: true, slug: clinic.slug };
}

export async function createScheduleBlock(formData: FormData) {
  const { clinicId, error: permErr } = await requireAdmin();
  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };

  const user = await getSession();
  const professionalId = String(formData.get("professional_id") ?? "");
  const startAt = String(formData.get("start_at") ?? "");
  const endAt = String(formData.get("end_at") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "Bloqueo";

  if (!professionalId || !startAt || !endAt) return { error: "Completá todos los campos" };

  const supabase = await createClient();
  const { error } = await supabase.from("schedule_blocks").insert({
    clinic_id: clinicId,
    professional_id: professionalId,
    start_at: new Date(startAt).toISOString(),
    end_at: new Date(endAt).toISOString(),
    reason,
    created_by: user?.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/agenda");
  return { success: true };
}

export async function createAvailabilityRule(formData: FormData) {
  const { clinicId, error: permErr } = await requireAdmin();
  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };

  const schema = z.object({
    professional_id: z.string().uuid(),
    day_of_week: z.coerce.number().min(0).max(6),
    start_time: z.string(),
    end_time: z.string(),
    slot_duration: z.coerce.number().min(10).max(120).default(30),
  });

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.from("availability_rules").insert({
    clinic_id: clinicId,
    ...parsed.data,
  });
  if (error) return { error: error.message };
  revalidatePath("/configuracion");
  revalidatePath("/agenda");
  return { success: true };
}

export async function deactivatePatient(id: string) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "managePatients", isSuperadmin)) {
    return { error: "Sin permisos" };
  }

  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id, first_name, last_name, is_active")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) return { error: "Paciente no encontrado" };
  if (!patient.is_active) return { error: "El paciente ya fue eliminado" };

  const { error } = await supabase
    .from("patients")
    .update({ is_active: false })
    .eq("id", id)
    .eq("clinic_id", clinicId);
  if (error) return { error: error.message };

  await logAudit({
    clinicId,
    entityType: "patient",
    entityId: id,
    action: "delete",
    metadata: {
      name: `${patient.first_name} ${patient.last_name}`,
      softDelete: true,
    },
  });

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${id}`);
  return { success: true };
}
