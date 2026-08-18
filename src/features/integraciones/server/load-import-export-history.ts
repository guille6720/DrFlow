import "server-only";

import { getActiveClinicId, getPermissionContext, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

export type ImportExportHistoryRow = {
  id: string;
  action: string;
  what: string | null;
  entityType: string;
  occurredAt: string;
  actorName: string;
  fileName: string | null;
  status: string | null;
  recordCount: number | null;
  format: string | null;
};

export async function loadImportExportHistory(limit = 40): Promise<{
  rows: ImportExportHistoryRow[];
  error?: string;
}> {
  const user = await getSession();
  if (!user) return { rows: [], error: "Sin sesión" };

  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin, permissionOverrides } = await getPermissionContext();
  const canSee =
    hasPermission(role, "bulkExportData", isSuperadmin, permissionOverrides) ||
    hasPermission(role, "manageSettings", isSuperadmin, permissionOverrides) ||
    hasPermission(role, "importPatients", isSuperadmin, permissionOverrides) ||
    hasPermission(role, "exportPatients", isSuperadmin, permissionOverrides) ||
    hasPermission(role, "importClinicalRecords", isSuperadmin, permissionOverrides) ||
    hasPermission(role, "exportClinicalRecords", isSuperadmin, permissionOverrides);

  if (!clinicId || !canSee) return { rows: [], error: "Sin permisos" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, what, entity_type, created_at, metadata, profiles(full_name)")
    .eq("clinic_id", clinicId)
    .in("entity_type", ["data_import_session", "data_export", "clinic_job", "patient"])
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 80));

  if (error) return { rows: [], error: "No se pudo cargar el historial." };

  const rows: ImportExportHistoryRow[] = [];
  for (const row of data ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const type = typeof meta.type === "string" ? meta.type : "";
    const isImportExport =
      row.entity_type === "data_import_session" ||
      row.entity_type === "data_export" ||
      type.includes("import") ||
      type.includes("export") ||
      row.action === "export";
    if (!isImportExport) continue;

    const profile = row.profiles as { full_name?: string } | { full_name?: string }[] | null;
    const actor =
      (Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name) ?? "Usuario";

    rows.push({
      id: row.id,
      action: row.action,
      what: row.what,
      entityType: row.entity_type,
      occurredAt: row.created_at,
      actorName: actor,
      fileName: typeof meta.fileName === "string" ? meta.fileName : null,
      status: typeof meta.status === "string" ? meta.status : null,
      recordCount:
        typeof meta.recordCount === "number"
          ? meta.recordCount
          : typeof meta.patientsCreated === "number"
            ? Number(meta.patientsCreated)
            : null,
      format: typeof meta.format === "string" ? meta.format : null,
    });
  }

  return { rows: rows.slice(0, limit) };
}
