import "server-only";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import { ipAddressFromUnknown } from "@/core/supabase/json";
import { createClient } from "@/core/supabase/server";

export type ClinicSensitiveAccessLogRow = {
  id: string;
  action: string;
  what: string | null;
  module: string | null;
  entityType: string;
  patientId: string | null;
  patientName: string | null;
  actorName: string;
  occurredAt: string;
  ipAddress: string | null;
  accessKind: string | null;
  tab: string | null;
};

export async function loadClinicSensitiveAccessLogs(
  limit = 40
): Promise<{ rows: ClinicSensitiveAccessLogRow[]; error?: string }> {
  const user = await getSession();
  if (!user) return { rows: [], error: "Sin sesión" };

  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "manageSettings", isSuperadmin)) {
    return { rows: [], error: "Sin permisos" };
  }

  const supabase = await createClient();
  const fetchLimit = Math.min(Math.max(limit, 1), 100) * 3;

  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select(
      "id, action, what, module, entity_type, patient_id, created_at, ip_address, metadata, profiles(full_name)"
    )
    .eq("clinic_id", clinicId)
    .in("action", ["view", "export"])
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (error) return { rows: [], error: "No se pudieron cargar los accesos" };

  const sensitive = (logs ?? []).filter((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (row.action === "view" && typeof meta.access_kind === "string") return true;
    if (row.action === "export") {
      const reason = meta.reason;
      return (
        reason === "habeas_data_patient_export" || reason === "habeas_data_clinic_export"
      );
    }
    return false;
  });

  const page = sensitive.slice(0, limit);
  const patientIds = [
    ...new Set(page.map((r) => r.patient_id).filter((id): id is string => Boolean(id))),
  ];

  const patientNames = new Map<string, string>();
  if (patientIds.length > 0) {
    const { data: patients } = await supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("clinic_id", clinicId)
      .in("id", patientIds);

    for (const p of patients ?? []) {
      patientNames.set(p.id, `${p.first_name} ${p.last_name}`.trim());
    }
  }

  const rows: ClinicSensitiveAccessLogRow[] = page.map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const patientId = row.patient_id as string | null;
    return {
      id: row.id,
      action: row.action,
      what: row.what,
      module: row.module,
      entityType: row.entity_type,
      patientId,
      patientName: patientId ? (patientNames.get(patientId) ?? null) : null,
      actorName: (profile as { full_name?: string } | null)?.full_name ?? "Usuario",
      occurredAt: row.created_at,
      ipAddress: ipAddressFromUnknown(row.ip_address),
      accessKind: typeof meta.access_kind === "string" ? meta.access_kind : null,
      tab: typeof meta.tab === "string" ? meta.tab : null,
    };
  });

  return { rows };
}
