"use server";

import { z } from "zod";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { getSiteUrl } from "@/core/supabase/env";
import { createClient } from "@/core/supabase/server";
import { entityIdSchema, firstZodIssue } from "@/core/validations/params";

const createPortalAccessSchema = z.object({
  patientId: entityIdSchema,
  expiresMinutes: z.number().int().min(5).max(1440).default(30),
});

const DEFAULT_SCOPES = [
  "appointments:read",
  "appointments:cancel",
  "consent:write",
] as const;

/**
 * Staff: create a 30-minute magic link for the patient portal.
 * Returns the full URL (token only inside URL once; never log it).
 */
export async function createPatientPortalAccessLink(input: {
  patientId: string;
  expiresMinutes?: number;
}) {
  const access = await requireClinicPermission("managePatients");
  if (!access.ok) {
    return { error: access.error };
  }

  const parsed = createPortalAccessSchema.safeParse({
    patientId: input.patientId,
    expiresMinutes: input.expiresMinutes ?? 30,
  });
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }

  const supabase = await createClient();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, clinic_id")
    .eq("id", parsed.data.patientId)
    .eq("clinic_id", access.clinicId)
    .maybeSingle();

  if (patientError || !patient) {
    return { error: "Paciente no encontrado" };
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("slug")
    .eq("id", access.clinicId)
    .maybeSingle();

  const { data: bookingLink } = await supabase
    .from("public_booking_links")
    .select("slug")
    .eq("clinic_id", access.clinicId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const slug = (bookingLink?.slug || clinic?.slug || "").trim();
  if (!slug) {
    return { error: "La clínica no tiene slug de portal configurado" };
  }

  const { data, error } = await supabase.rpc("create_patient_portal_session", {
    p_clinic_id: access.clinicId,
    p_patient_id: patient.id,
    p_expires_minutes: parsed.data.expiresMinutes,
    p_scopes: [...DEFAULT_SCOPES],
  });

  if (error) {
    return {
      error: resolvePostgresUserMessage(error, {
        rpcMessages: {
          FORBIDDEN: "Sin permisos para generar acceso al portal",
          PATIENT_NOT_FOUND: "Paciente no encontrado",
          NOT_AUTHENTICATED: "Sesión vencida",
        },
        fallback: "No pudimos generar el enlace de acceso.",
      }),
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const token = (row as { token?: string } | null)?.token?.trim() ?? "";
  const expiresAt = (row as { expires_at?: string } | null)?.expires_at ?? null;
  const sessionId = (row as { session_id?: string } | null)?.session_id ?? null;

  if (!token || !/^[0-9a-f]{64}$/i.test(token)) {
    return { error: "No pudimos generar el enlace de acceso." };
  }

  const origin = getSiteUrl();
  const accessUrl = `${origin}/portal/${encodeURIComponent(slug)}/access?token=${token}`;

  return {
    success: true as const,
    accessUrl,
    expiresAt,
    sessionId,
    expiresMinutes: parsed.data.expiresMinutes,
  };
}
