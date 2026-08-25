"use server";

import { redirect } from "next/navigation";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { revalidateAppointmentSurfaces } from "@/core/cache/revalidate-appointment-surfaces";
import { toErrorMessage } from "@/core/errors/error-utils";
import { logServerError } from "@/core/errors/log-error.server";
import {
  isMissingRpcInSchemaCache,
  parsePostgresError,
  PG_ERROR_CODES,
  resolvePostgresUserMessage,
  type PostgresErrorLike,
} from "@/core/errors/postgres-error";
import { recordAudit } from "@/core/security/audit-service";
import { verifyAppointmentForeignKeys } from "@/core/security/ownership-guard";
import { nullToUndefined } from "@/core/supabase/json";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue } from "@/core/validations/params";
import { sanitizeText } from "@/core/validations/schemas";

import { turnoWizardSchema, type TurnoWizardInput } from "@/features/turnos/utils/turno-wizard-schema";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const OPTIONAL_APPOINTMENT_INSERT_COLUMNS = [
  "is_overbooking",
  "overbooking_reason",
  "priority",
  "insurance_provider_snapshot",
  "insurance_plan_snapshot",
  "booking_source",
  "consultation_modality",
] as const;

function isNextNavigationError(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("digest" in err)) return false;
  const digest = String((err as { digest: string }).digest);
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

function isMissingColumnError(
  error: PostgresErrorLike | null | undefined,
  column: string
): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === PG_ERROR_CODES.UNDEFINED_COLUMN ||
    message.includes(`'${column.toLowerCase()}'`) ||
    message.includes(`"${column.toLowerCase()}"`) ||
    message.includes(`column ${column.toLowerCase()}`)
  );
}

function mapCreateTurnoRpcError(message: string | null | undefined): string | null {
  const code = (message ?? "").trim();
  if (code === "SLOT_NOT_AVAILABLE" || code === "APPOINTMENT_SLOT_CONFLICT") {
    return "El horario ya no está disponible.";
  }
  if (code === "SLOT_BLOCKED") return "El horario está bloqueado.";
  if (code === "FORBIDDEN") return "No tenés permiso para crear turnos.";
  if (code === "PATIENT_NOT_FOUND") return "Paciente no encontrado en el consultorio activo.";
  if (code === "PROFESSIONAL_NOT_FOUND") return "Profesional no encontrado o inactivo.";
  if (code === "INVALID_TIME_RANGE") return "Horario inválido.";
  if (code === "OVERBOOKING_REASON_REQUIRED") return "Indicá el motivo del sobreturno.";
  if (code === "INVALID_MODALITY") return "Tipo de atención inválido.";
  return null;
}

function resolveCreateTurnoRpcError(error: PostgresErrorLike): string {
  const mapped =
    mapCreateTurnoRpcError(error.message) ||
    mapCreateTurnoRpcError(error.details) ||
    mapCreateTurnoRpcError(error.hint);
  if (mapped) return mapped;

  return resolvePostgresUserMessage(error, {
    fallback: error.message || "No se pudo confirmar el turno. Intentá de nuevo.",
  });
}

function shouldTryDirectInsertFallback(error: PostgresErrorLike): boolean {
  if (isMissingRpcInSchemaCache(error)) return true;

  const parsed = parsePostgresError(error);
  if (
    parsed.pgCode === PG_ERROR_CODES.UNDEFINED_FUNCTION ||
    parsed.pgCode === PG_ERROR_CODES.UNDEFINED_COLUMN ||
    parsed.pgCode === PG_ERROR_CODES.UNDEFINED_TABLE
  ) {
    return true;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("append_appointment_status_history") ||
    message.includes("create_staff_appointment_atomic")
  );
}

function extractAppointmentId(rpcResult: unknown): string | null {
  if (typeof rpcResult === "object" && rpcResult !== null && "appointment_id" in rpcResult) {
    return String((rpcResult as { appointment_id: string }).appointment_id);
  }
  if (typeof rpcResult === "string") {
    try {
      return extractAppointmentId(JSON.parse(rpcResult) as unknown);
    } catch {
      return null;
    }
  }
  return null;
}

function buildAppointmentInsertPayload(
  clinicId: string,
  userId: string,
  data: TurnoWizardInput
): Record<string, unknown> {
  return {
    clinic_id: clinicId,
    patient_id: data.patient_id,
    professional_id: data.professional_id,
    location_id: data.location_id ?? null,
    specialty_id: data.specialty_id ?? null,
    start_at: data.start_at,
    end_at: data.end_at,
    status: "pending",
    notes: data.notes ? sanitizeText(data.notes) : null,
    created_by: userId,
    booking_source: "manual",
    consultation_modality: data.consultation_modality,
    is_overbooking: data.is_overbooking,
    overbooking_reason: data.overbooking_reason
      ? sanitizeText(data.overbooking_reason)
      : null,
    priority: data.priority,
    insurance_provider_snapshot: data.insurance_provider ?? null,
    insurance_plan_snapshot: data.insurance_plan ?? null,
  };
}

async function insertStaffAppointmentDirect(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  userId: string,
  data: TurnoWizardInput
): Promise<{ ok: true; appointmentId: string } | { ok: false; error: string }> {
  if (!data.is_overbooking) {
    const { data: conflict } = await supabase
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("professional_id", data.professional_id)
      .neq("status", "cancelled")
      .lt("start_at", data.end_at)
      .gt("end_at", data.start_at)
      .limit(1)
      .maybeSingle();
    if (conflict?.id) {
      return { ok: false, error: "El horario ya no está disponible." };
    }
  }

  let payload = buildAppointmentInsertPayload(clinicId, userId, data);

  for (let attempt = 0; attempt < OPTIONAL_APPOINTMENT_INSERT_COLUMNS.length + 2; attempt += 1) {
    const { data: row, error } = await supabase
      .from("appointments")
      .insert(payload as Database["public"]["Tables"]["appointments"]["Insert"])
      .select("id")
      .single();

    if (!error && row?.id) {
      return { ok: true, appointmentId: row.id };
    }

    const missingOptional = OPTIONAL_APPOINTMENT_INSERT_COLUMNS.find((column) =>
      isMissingColumnError(error, column)
    );
    if (missingOptional && missingOptional in payload) {
      const nextPayload = { ...payload };
      delete nextPayload[missingOptional];
      payload = nextPayload;
      continue;
    }

    return {
      ok: false,
      error: resolvePostgresUserMessage(error, {
        fallback: error?.message || "No se pudo confirmar el turno. Intentá de nuevo.",
      }),
    };
  }

  return { ok: false, error: "No se pudo confirmar el turno. Intentá de nuevo." };
}

export async function createTurnoWizard(input: unknown) {
  try {
    const [access, supabase] = await Promise.all([
      requireClinicPermission("manageAppointments"),
      createClient(),
    ]);
    if (!access.ok) return { error: access.error };
    const { clinicId, userId } = access;

    const parsed = turnoWizardSchema.safeParse(input);
    if (!parsed.success) return { error: firstZodIssue(parsed.error) };

    const data = parsed.data;

    const ownership = await verifyAppointmentForeignKeys(supabase, clinicId, {
      patientId: data.patient_id,
      professionalId: data.professional_id,
      locationId: data.location_id,
      specialtyId: data.specialty_id,
    });
    if (!ownership.ok) return { error: ownership.error };

    let appointmentId: string | null = null;

    const { data: rpcResult, error } = await supabase.rpc("create_staff_appointment_atomic", {
      p_clinic_id: clinicId,
      p_patient_id: data.patient_id,
      p_professional_id: data.professional_id,
      p_start_at: data.start_at,
      p_end_at: data.end_at,
      p_location_id: nullToUndefined(data.location_id ?? null),
      p_specialty_id: nullToUndefined(data.specialty_id ?? null),
      p_notes: nullToUndefined(data.notes ? sanitizeText(data.notes) : null),
      p_consultation_modality: data.consultation_modality,
      p_is_overbooking: data.is_overbooking,
      p_overbooking_reason: nullToUndefined(
        data.overbooking_reason ? sanitizeText(data.overbooking_reason) : null
      ),
      p_priority: data.priority,
      p_insurance_provider: nullToUndefined(data.insurance_provider ?? null),
      p_insurance_plan: nullToUndefined(data.insurance_plan ?? null),
      p_created_by: userId,
    });

    if (error) {
      if (shouldTryDirectInsertFallback(error)) {
        const fallback = await insertStaffAppointmentDirect(supabase, clinicId, userId, data);
        if (!fallback.ok) return { error: fallback.error };
        appointmentId = fallback.appointmentId;
      } else {
        return { error: resolveCreateTurnoRpcError(error) };
      }
    } else {
      appointmentId = extractAppointmentId(rpcResult);
      if (!appointmentId) {
        return { error: "El turno se creó pero no se pudo leer el identificador. Revisá la agenda." };
      }
    }

    try {
      await recordAudit({
        clinicId,
        module: "appointments",
        what: data.is_overbooking ? "Sobreturno creado" : "Turno creado",
        entityType: "appointment",
        entityId: appointmentId,
        patientId: data.patient_id,
        action: "create",
        metadata: {
          is_overbooking: data.is_overbooking,
          priority: data.priority,
          consultation_modality: data.consultation_modality,
        },
      });
    } catch (auditErr) {
      logServerError("createTurnoWizard.audit", auditErr, { clinicId });
    }

    try {
      revalidateAppointmentSurfaces({ patientId: data.patient_id });
    } catch (revalidateErr) {
      logServerError("createTurnoWizard.revalidate", revalidateErr, { clinicId });
    }

    redirect("/turnos/agenda");
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    logServerError("createTurnoWizard", err, { persist: true });
    return {
      error: toErrorMessage(err) || "No se pudo confirmar el turno. Intentá de nuevo.",
    };
  }
}
