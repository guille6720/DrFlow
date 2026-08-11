"use server";



import { revalidatePath } from "next/cache";

import { requireSettingsAccess } from "@/core/actions/clinic-guard";
import { getActiveClinic, getActiveClinicId, getSession, logAudit } from "@/core/auth/session.server";
import {
  revalidateClinicLocationsCache,
  revalidateClinicPortalCache,
  revalidateClinicProfessionalsCache,
  revalidateClinicSettingsCache,
  revalidateClinicSpecialtiesCache,
} from "@/core/cache/revalidate-clinic-cache";
import { hasPermission } from "@/core/permissions/roles";
import { recordAuditChange } from "@/core/security/audit-service";
import {
  verifyOptionalSpecialtyInClinic,
  verifyProfessionalInClinic,
} from "@/core/security/ownership-guard";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue, parseEntityId } from "@/core/validations/params";
import {
  clinicSettingsSchema,
  createAvailabilityRuleSchema,
  createLocationSchema,
  createProfessionalSchema,
  createScheduleBlockSchema,
  namedEntitySchema,
  parseClinicSettingsForm,
  parseCreateProfessionalForm,
  parseScheduleBlockForm,
} from "@/core/validations/settings-schemas";

export async function updateClinicSettings(formData: FormData) {
  const { clinicId, error: permErr } = await requireSettingsAccess();

  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };



  const parsed = clinicSettingsSchema.safeParse(parseClinicSettingsForm(formData));

  if (!parsed.success) return { error: firstZodIssue(parsed.error) };



  const supabase = await createClient();

  const { data: before } = await supabase
    .from("clinics")
    .select("name, phone, email, address, default_appointment_duration, voice_input_enabled")
    .eq("id", clinicId)
    .single();

  const { error } = await supabase

    .from("clinics")

    .update({

      name: parsed.data.name,

      phone: parsed.data.phone,

      email: parsed.data.email,

      address: parsed.data.address,

      default_appointment_duration: parsed.data.default_appointment_duration,

      voice_input_enabled: parsed.data.voice_input_enabled,

    })

    .eq("id", clinicId);



  if (error) return { error: error.message };

  const after = {
    name: parsed.data.name,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    address: parsed.data.address ?? null,
    default_appointment_duration: parsed.data.default_appointment_duration,
    voice_input_enabled: parsed.data.voice_input_enabled,
  };

  await recordAuditChange({
    clinicId,
    module: "settings",
    entityType: "clinic",
    entityId: clinicId,
    action: "update",
    what: "Actualizó configuración del consultorio",
    before: before ?? null,
    after,
    keys: ["name", "phone", "email", "address", "default_appointment_duration", "voice_input_enabled"],
  });

  revalidateClinicSettingsCache(clinicId);
  revalidatePath("/configuracion");

  revalidatePath("/agenda");

  revalidatePath("/historias");

  revalidatePath("/historias/nueva");

  return { success: true };

}



export async function createSpecialty(name: string) {

  const { clinicId, error: permErr } = await requireSettingsAccess();

  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };



  const parsed = namedEntitySchema.safeParse(name.trim());

  if (!parsed.success) return { error: firstZodIssue(parsed.error) };



  const supabase = await createClient();

  const { error } = await supabase

    .from("specialties")

    .insert({ clinic_id: clinicId, name: parsed.data });

  if (error) return { error: error.message };

  revalidateClinicSpecialtiesCache(clinicId);
  revalidatePath("/configuracion");

  return { success: true };

}



export async function deleteSpecialty(id: string) {

  const { clinicId, error: permErr } = await requireSettingsAccess();

  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };



  const idParsed = parseEntityId(id, "Especialidad");

  if (!idParsed.ok) return { error: idParsed.error };



  const supabase = await createClient();

  const { error } = await supabase

    .from("specialties")

    .delete()

    .eq("id", idParsed.data)

    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidateClinicSpecialtiesCache(clinicId);
  revalidatePath("/configuracion");

  return { success: true };

}



export async function createLocation(name: string, address?: string) {

  const { clinicId, error: permErr } = await requireSettingsAccess();

  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };



  const parsed = createLocationSchema.safeParse({ name: name.trim(), address: address?.trim() });

  if (!parsed.success) return { error: firstZodIssue(parsed.error) };



  const supabase = await createClient();

  const { error } = await supabase.from("locations").insert({

    clinic_id: clinicId,

    name: parsed.data.name,

    address: parsed.data.address || null,

  });

  if (error) return { error: error.message };

  revalidateClinicLocationsCache(clinicId);
  revalidatePath("/configuracion");

  return { success: true };

}



export async function deleteLocation(id: string) {

  const { clinicId, error: permErr } = await requireSettingsAccess();

  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };



  const idParsed = parseEntityId(id, "Ubicación");

  if (!idParsed.ok) return { error: idParsed.error };



  const supabase = await createClient();

  const { error } = await supabase

    .from("locations")

    .delete()

    .eq("id", idParsed.data)

    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidateClinicLocationsCache(clinicId);
  revalidatePath("/configuracion");

  return { success: true };

}



export async function createConsultationReason(name: string) {

  const { clinicId, error: permErr } = await requireSettingsAccess();

  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };



  const parsed = namedEntitySchema.safeParse(name.trim());

  if (!parsed.success) return { error: firstZodIssue(parsed.error) };



  const supabase = await createClient();

  const { error } = await supabase

    .from("consultation_reasons")

    .insert({ clinic_id: clinicId, name: parsed.data });

  if (error) return { error: error.message };

  revalidatePath("/configuracion");

  return { success: true };

}



export async function createProfessional(formData: FormData) {

  const { clinicId, error: permErr } = await requireSettingsAccess();

  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };



  const user = await getSession();

  const raw = parseCreateProfessionalForm(formData);

  const parsed = createProfessionalSchema.safeParse({

    ...raw,

    user_id: raw.user_id || user?.id || null,

  });

  if (!parsed.success) return { error: firstZodIssue(parsed.error) };



  const supabase = await createClient();

  const specialtyOwnership = await verifyOptionalSpecialtyInClinic(
    supabase,
    clinicId,
    parsed.data.specialty_id
  );
  if (!specialtyOwnership.ok) return { error: specialtyOwnership.error };

  const { error } = await supabase.from("professionals").insert({

    clinic_id: clinicId,

    user_id: parsed.data.user_id,

    specialty_id: parsed.data.specialty_id,

    display_name: parsed.data.display_name,

    license_number: parsed.data.license_number,

  });

  if (error) return { error: error.message };

  revalidateClinicProfessionalsCache(clinicId);
  revalidatePath("/configuracion");

  revalidatePath("/agenda");

  return { success: true };

}



export async function enablePublicBooking() {

  const { clinicId, error: permErr } = await requireSettingsAccess();

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

  revalidateClinicPortalCache(clinicId);
  revalidatePath("/configuracion");

  revalidatePath("/agenda");

  return { success: true, slug: clinic.slug };

}



export async function createScheduleBlock(formData: FormData) {

  const { clinicId, error: permErr } = await requireSettingsAccess();

  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };



  const parsed = createScheduleBlockSchema.safeParse(parseScheduleBlockForm(formData));

  if (!parsed.success) return { error: firstZodIssue(parsed.error) };



  const user = await getSession();

  const supabase = await createClient();

  const professionalOwnership = await verifyProfessionalInClinic(
    supabase,
    clinicId,
    parsed.data.professional_id
  );
  if (!professionalOwnership.ok) return { error: professionalOwnership.error };

  const { error } = await supabase.from("schedule_blocks").insert({

    clinic_id: clinicId,

    professional_id: parsed.data.professional_id,

    start_at: new Date(parsed.data.start_at).toISOString(),

    end_at: new Date(parsed.data.end_at).toISOString(),

    reason: parsed.data.reason,

    created_by: user?.id,

  });

  if (error) return { error: error.message };

  revalidatePath("/agenda");
  revalidatePath("/turnos/agenda");
  revalidatePath("/turnos/configuracion");

  return { success: true };

}



export async function createAvailabilityRule(formData: FormData) {

  const { clinicId, error: permErr } = await requireSettingsAccess();

  if (permErr || !clinicId) return { error: permErr ?? "Sin clínica" };



  const parsed = createAvailabilityRuleSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) return { error: firstZodIssue(parsed.error) };



  const supabase = await createClient();

  const professionalOwnership = await verifyProfessionalInClinic(
    supabase,
    clinicId,
    parsed.data.professional_id
  );
  if (!professionalOwnership.ok) return { error: professionalOwnership.error };

  const { error } = await supabase.from("availability_rules").insert({

    clinic_id: clinicId,

    ...parsed.data,

  });

  if (error) return { error: error.message };

  revalidatePath("/configuracion");

  revalidatePath("/agenda");
  revalidatePath("/turnos/agenda");
  revalidatePath("/turnos/configuracion");

  return { success: true };

}



export async function deactivatePatient(id: string, formData?: FormData) {

  const clinicId = await getActiveClinicId();

  const { role, isSuperadmin } = await getActiveClinic();

  if (!clinicId || !hasPermission(role, "managePatients", isSuperadmin)) {

    return { error: "Sin permisos" };

  }

  const user = await getSession();
  if (!user) return { error: "Sin sesión" };

  const idParsed = parseEntityId(id, "Paciente");

  if (!idParsed.ok) return { error: idParsed.error };

  const retentionAcknowledged = formData?.get("retention_acknowledged") === "true";

  const supabase = await createClient();

  const [{ data: clinic }, { data: patient }, { data: records }] = await Promise.all([
    supabase
      .from("clinics")
      .select("clinical_record_retention_years")
      .eq("id", clinicId)
      .single(),
    supabase
      .from("patients")
      .select("id, first_name, last_name, is_active")
      .eq("id", idParsed.data)
      .eq("clinic_id", clinicId)
      .single(),
    supabase
      .from("clinical_records")
      .select("created_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", idParsed.data),
  ]);

  if (!patient) return { error: "Paciente no encontrado" };

  if (!patient.is_active) return { error: "El paciente ya fue eliminado" };

  const recordCount = records?.length ?? 0;
  if (recordCount > 0 && !retentionAcknowledged) {
    return {
      error: "Debés confirmar que comprendés la política de retención antes de dar de baja al paciente.",
    };
  }

  const { error } = await supabase

    .from("patients")

    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: user.id,
    })

    .eq("id", idParsed.data)

    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  await logAudit({

    clinicId,

    module: "compliance",

    what: "Baja lógica de paciente (retención clínica)",

    entityType: "patient",

    entityId: idParsed.data,

    patientId: idParsed.data,

    action: "delete",

    metadata: {

      name: `${patient.first_name} ${patient.last_name}`,

      softDelete: true,

      clinicalRecordCount: recordCount,

      retentionYears: clinic?.clinical_record_retention_years ?? null,

      retentionAcknowledged,

    },

  });



  revalidatePath("/pacientes");

  revalidatePath(`/pacientes/${idParsed.data}`);

  return { success: true };

}


