"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/core/auth/session.actions";
import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import {
  canFulfillPrivacyRequest,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
  type PrivacyRequestStatus,
  type PrivacyRequestType,
  requiresRetentionWarning,
} from "@/core/compliance/privacy-rights";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

const createSchema = z.object({
  request_type: z.enum(PRIVACY_REQUEST_TYPES),
  patient_id: z.string().uuid().optional().nullable(),
  requester_name: z.string().trim().max(200).optional().nullable(),
  requester_contact: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(PRIVACY_REQUEST_STATUSES),
  resolution_notes: z.string().trim().max(4000).optional().nullable(),
  retention_warning_acknowledged: z.boolean().optional(),
});

export type PrivacyRightsRequestRow = {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  request_type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  requester_name: string | null;
  requester_contact: string | null;
  description: string | null;
  retention_warning_acknowledged: boolean;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
};

export async function listPrivacyRightsRequests(): Promise<{
  rows?: PrivacyRightsRequestRow[];
  error?: string;
}> {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (
    !clinicId ||
    !(
      hasPermission(role, "manageSettings", isSuperadmin) ||
      hasPermission(role, "viewClinicalRecords", isSuperadmin)
    )
  ) {
    return { error: "Sin permisos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("privacy_rights_requests")
    .select(
      "id, clinic_id, patient_id, request_type, status, requester_name, requester_contact, description, retention_warning_acknowledged, resolution_notes, created_at, resolved_at"
    )
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { error: "No se pudieron cargar los pedidos de privacidad." };
  return { rows: (data ?? []) as PrivacyRightsRequestRow[] };
}

export async function createPrivacyRightsRequest(input: {
  requestType: string;
  patientId?: string | null;
  requesterName?: string | null;
  requesterContact?: string | null;
  description?: string | null;
}) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const user = await getSession();
  if (
    !clinicId ||
    !user ||
    !(
      hasPermission(role, "manageSettings", isSuperadmin) ||
      hasPermission(role, "managePatients", isSuperadmin)
    )
  ) {
    return { error: "Sin permisos para registrar el pedido." };
  }

  const parsed = createSchema.safeParse({
    request_type: input.requestType,
    patient_id: input.patientId || null,
    requester_name: input.requesterName || null,
    requester_contact: input.requesterContact || null,
    description: input.description || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  if (parsed.data.patient_id) {
    const idCheck = parseEntityId(parsed.data.patient_id, "Paciente");
    if (!idCheck.ok) return { error: idCheck.error };
  }

  const supabase = await createClient();

  if (parsed.data.patient_id) {
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("id", parsed.data.patient_id)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (!patient) return { error: "Paciente no encontrado en este consultorio." };
  }

  const { data, error } = await supabase
    .from("privacy_rights_requests")
    .insert({
      clinic_id: clinicId,
      patient_id: parsed.data.patient_id,
      request_type: parsed.data.request_type,
      status: "received",
      requester_name: parsed.data.requester_name,
      requester_contact: parsed.data.requester_contact,
      description: parsed.data.description,
      created_by: user.id,
      retention_warning_acknowledged: false,
    })
    .select("id")
    .single();

  if (error) return { error: "No se pudo registrar el pedido." };

  await logAudit({
    clinicId,
    module: "compliance",
    what: "Registró pedido de derechos de privacidad (ARCO)",
    entityType: "privacy_rights_request",
    entityId: data.id,
    patientId: parsed.data.patient_id ?? undefined,
    action: "create",
    metadata: { request_type: parsed.data.request_type },
  });

  revalidatePath("/configuracion");
  return { id: data.id };
}

export async function updatePrivacyRightsRequest(input: {
  id: string;
  status: string;
  resolutionNotes?: string | null;
  retentionWarningAcknowledged?: boolean;
}) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const user = await getSession();
  if (!clinicId || !user || !hasPermission(role, "manageSettings", isSuperadmin)) {
    return { error: "Sin permisos para actualizar el pedido." };
  }

  const parsed = updateSchema.safeParse({
    id: input.id,
    status: input.status,
    resolution_notes: input.resolutionNotes ?? null,
    retention_warning_acknowledged: input.retentionWarningAcknowledged,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("privacy_rights_requests")
    .select("id, request_type, retention_warning_acknowledged")
    .eq("id", parsed.data.id)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!existing) return { error: "Pedido no encontrado." };

  const ack =
    parsed.data.retention_warning_acknowledged ??
    Boolean(existing.retention_warning_acknowledged);

  const gate = canFulfillPrivacyRequest({
    type: existing.request_type as PrivacyRequestType,
    status: parsed.data.status,
    retentionWarningAcknowledged: ack,
  });
  if (!gate.ok) return { error: gate.error };

  const resolved =
    parsed.data.status === "fulfilled" ||
    parsed.data.status === "rejected" ||
    parsed.data.status === "cancelled";

  const { error } = await supabase
    .from("privacy_rights_requests")
    .update({
      status: parsed.data.status,
      resolution_notes: parsed.data.resolution_notes,
      retention_warning_acknowledged: ack,
      resolved_by: resolved ? user.id : null,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id)
    .eq("clinic_id", clinicId);

  if (error) {
    if (error.message?.includes("PRIVACY_RETENTION_ACK_REQUIRED")) {
      return {
        error:
          "Confirmá la advertencia de retención clínica antes de marcar como cumplido un pedido de supresión/bloqueo.",
      };
    }
    return { error: "No se pudo actualizar el pedido." };
  }

  await logAudit({
    clinicId,
    module: "compliance",
    what: "Actualizó pedido de derechos de privacidad",
    entityType: "privacy_rights_request",
    entityId: parsed.data.id,
    action: "update",
    metadata: {
      status: parsed.data.status,
      retention_warning_acknowledged: ack,
      requires_retention_warning: requiresRetentionWarning(
        existing.request_type as PrivacyRequestType
      ),
    },
  });

  revalidatePath("/configuracion");
  return { success: true };
}
