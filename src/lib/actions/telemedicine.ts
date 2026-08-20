"use server";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { getSession } from "@/core/auth/session.server";
import { recordAudit } from "@/core/security/audit-service";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { nullToUndefined } from "@/core/supabase/json";
import {
  APPOINTMENT_TELEMEDICINE_COLUMNS,
  TELEMEDICINE_SESSION_LIST_COLUMNS,
} from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";
import {
  buildPatientJoinUrl,
  isTelemedicineSessionJoinable,
} from "@/core/telemedicine/provider";
import { parseEntityId } from "@/core/validations/params";

import { telemedicineService } from "@/lib/services/telemedicine";
import { deliverTelemedicineLinkEmail } from "@/lib/services/telemedicine-email";
import { deliverTelemedicineLinkWhatsApp } from "@/lib/services/telemedicine-whatsapp";
import type { TelemedicineStatus } from "@/types/database";

const APPOINTMENT_TELE_SELECT = `${APPOINTMENT_TELEMEDICINE_COLUMNS}, start_at, consultation_modality, patients(first_name, last_name, email, phone)`;

export type TelemedicineSessionRow = {
  id: string;
  clinic_id: string;
  appointment_id: string;
  room_url: string;
  status: TelemedicineStatus;
  provider: string;
  patient_join_url: string | null;
  expires_at: string | null;
  started_at: string | null;
  ended_at: string | null;
};

async function loadAppointmentForTelemedicine(clinicId: string, appointmentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select(APPOINTMENT_TELE_SELECT)
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .single();
  return data;
}

export async function getOrCreateTelemedicineSession(appointmentId: string) {
  const access = await requireClinicPermission("viewClinicalRecords");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();
  if (!user?.id) return { error: "Sesión requerida" };

  const idParsed = parseEntityId(appointmentId, "Turno");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("telemedicine_sessions")
    .select(TELEMEDICINE_SESSION_LIST_COLUMNS)
    .eq("appointment_id", idParsed.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (existing && existing.status !== "cancelled") {
    const row = existing as TelemedicineSessionRow;
    if (!row.patient_join_url) {
      const patientJoinUrl = buildPatientJoinUrl(row.id);
      await supabase
        .from("telemedicine_sessions")
        .update({ patient_join_url: patientJoinUrl })
        .eq("id", row.id)
        .eq("clinic_id", clinicId);
      row.patient_join_url = patientJoinUrl;
    }
    return { data: row };
  }

  const appointment = await loadAppointmentForTelemedicine(clinicId, idParsed.data);
  if (!appointment) return { error: "Turno no encontrado" };

  const patient = appointment.patients as unknown as {
    first_name: string;
    last_name: string;
  };

  const room = await telemedicineService.createRoom(
    idParsed.data,
    `${patient.first_name} ${patient.last_name}`,
    appointment.start_at as string
  );

  const { data, error } = await supabase.rpc("create_telemedicine_session_atomic", {
    p_clinic_id: clinicId,
    p_appointment_id: idParsed.data,
    p_room_url: room.roomUrl,
    p_status: room.status,
    p_created_by: user.id,
    p_provider: room.provider,
    p_external_room_id: nullToUndefined(room.externalRoomId),
    p_patient_join_url: nullToUndefined<string>(null),
    p_expires_at: nullToUndefined(room.expiresAt),
  });

  if (error) return { error: error.message };

  const session = data as TelemedicineSessionRow;
  const patientJoinUrl = buildPatientJoinUrl(session.id);

  if (session.patient_join_url !== patientJoinUrl) {
    await supabase
      .from("telemedicine_sessions")
      .update({ patient_join_url: patientJoinUrl })
      .eq("id", session.id)
      .eq("clinic_id", clinicId);
    session.patient_join_url = patientJoinUrl;
  }

  await recordAudit({
    clinicId,
    module: "appointments",
    entityType: "telemedicine_session",
    entityId: session.id,
    patientId: appointment.patient_id as string | undefined,
    action: "create",
    what: "Creó sesión de videoconsulta",
    metadata: { appointment_id: idParsed.data, provider: room.provider },
  });

  revalidatePath("/telemedicina");
  revalidatePath("/turnos/agenda");
  revalidatePath("/atenciones");
  return { data: session };
}

export async function updateTelemedicineSessionStatus(
  sessionId: string,
  status: TelemedicineStatus
) {
  const access = await requireClinicPermission("viewClinicalRecords");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const idParsed = parseEntityId(sessionId, "Sesión");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_telemedicine_session_status", {
    p_clinic_id: clinicId,
    p_session_id: idParsed.data,
    p_status: status,
  });

  if (error) return { error: error.message };

  revalidatePath("/telemedicina");
  revalidatePath(`/telemedicina/sala/${idParsed.data}`);
  return { data: data as TelemedicineSessionRow };
}

export async function sendTelemedicineLinkToPatient(appointmentId: string) {
  const access = await requireClinicPermission("manageAppointments");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const sessionResult = await getOrCreateTelemedicineSession(appointmentId);
  if (sessionResult.error || !sessionResult.data) {
    return { error: sessionResult.error ?? "No se pudo crear la sala" };
  }

  const appointment = await loadAppointmentForTelemedicine(clinicId, appointmentId);
  if (!appointment) return { error: "Turno no encontrado" };

  const patient = appointment.patients as unknown as {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };

  const supabase = await createClient();
  const { data: clinicRow } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", clinicId)
    .single();

  const joinUrl =
    sessionResult.data.patient_join_url ?? buildPatientJoinUrl(sessionResult.data.id);
  const dateLabel = format(new Date(appointment.start_at as string), "PPPp", { locale: es });
  const patientName = `${patient.first_name} ${patient.last_name}`;
  const clinicName = clinicRow?.name ?? "el consultorio";

  if (patient.email?.trim()) {
    const emailResult = await deliverTelemedicineLinkEmail({
      to: patient.email.trim(),
      patientName,
      appointmentDate: dateLabel,
      clinicName,
      joinUrl,
    });

    if (emailResult.status === "sent") {
      await recordAudit({
        clinicId,
        module: "appointments",
        entityType: "telemedicine_session",
        entityId: sessionResult.data.id,
        patientId: appointment.patient_id as string | undefined,
        action: "update",
        what: "Envió link de videoconsulta por email",
      });
      return { success: true, channel: "email" as const, joinUrl };
    }

    return { error: emailResult.errorMessage };
  }

  if (patient.phone?.trim()) {
    const whatsappResult = await deliverTelemedicineLinkWhatsApp({
      to: patient.phone.trim(),
      patientName,
      appointmentDate: dateLabel,
      clinicName,
      joinUrl,
    });

    if (whatsappResult.status === "sent") {
      await recordAudit({
        clinicId,
        module: "appointments",
        entityType: "telemedicine_session",
        entityId: sessionResult.data.id,
        patientId: appointment.patient_id as string | undefined,
        action: "update",
        what: "Envió link de videoconsulta por WhatsApp API",
        metadata: { message_id: whatsappResult.messageId },
      });
      return { success: true, channel: "whatsapp" as const, joinUrl, sentViaApi: true };
    }

    if (whatsappResult.status === "manual") {
      return {
        success: true,
        channel: "whatsapp" as const,
        joinUrl,
        whatsappUrl: whatsappResult.whatsappUrl,
        sentViaApi: false,
      };
    }

    return { error: whatsappResult.errorMessage };
  }

  return { error: "El paciente no tiene email ni teléfono registrado" };
}

export type PublicTelemedicineSession = {
  id: string;
  roomUrl: string;
  provider: string;
  clinicName: string;
  patientName: string;
  appointmentStartAt: string;
  status: TelemedicineStatus;
};

export async function loadPublicTelemedicineSession(
  sessionId: string
): Promise<{ data?: PublicTelemedicineSession; error?: string }> {
  const idParsed = parseEntityId(sessionId, "Sesión");
  if (!idParsed.ok) return { error: idParsed.error };

  if (!hasAdminClient()) {
    return { error: "Videoconsulta no disponible temporalmente." };
  }

  const admin = createAdminClient();
  const { data: session, error } = await admin
    .from("telemedicine_sessions")
    .select(
      `${TELEMEDICINE_SESSION_LIST_COLUMNS}, provider, patient_join_url, expires_at, appointments(start_at, patients(first_name, last_name)), clinics(name)`
    )
    .eq("id", idParsed.data)
    .maybeSingle();

  if (error || !session) {
    return { error: "Link de videoconsulta inválido o expirado." };
  }

  const appointment = session.appointments as unknown as {
    start_at: string;
    patients?: { first_name: string; last_name: string } | null;
  } | null;
  const clinic = session.clinics as unknown as { name: string } | null;
  const patient = appointment?.patients;

  if (
    !isTelemedicineSessionJoinable({
      status: session.status,
      expiresAt: session.expires_at,
      appointmentStartAt: appointment?.start_at ?? new Date().toISOString(),
    })
  ) {
    return { error: "Esta videoconsulta ya no está disponible." };
  }

  return {
    data: {
      id: session.id,
      roomUrl: session.room_url,
      provider: session.provider ?? "jitsi",
      clinicName: clinic?.name ?? "Consultorio",
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : "Paciente",
      appointmentStartAt: appointment?.start_at ?? new Date().toISOString(),
      status: session.status as TelemedicineStatus,
    },
  };
}

export async function loadStaffTelemedicineSession(sessionId: string) {
  const access = await requireClinicPermission("viewClinicalRecords");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const idParsed = parseEntityId(sessionId, "Sesión");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telemedicine_sessions")
    .select(
      `${TELEMEDICINE_SESSION_LIST_COLUMNS}, provider, appointments(start_at, patients(first_name, last_name))`
    )
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error || !data) return { error: "Sesión no encontrada" };
  return { data };
}
