import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveClinic, getActiveClinicId } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import {
  runAdminOpsOrchestrator,
  listAdminOpsAgents,
  type AdminOpsTask,
} from "@/lib/utils/admin-ops-orchestrator";

const TASK_VALUES = [
  "daily_ops_summary",
  "waiting_queue",
  "cash_help",
  "admin_help",
  "revenue_today",
  "revenue_month",
  "authorizations_list",
  "admin_ops_query",
] as const satisfies readonly AdminOpsTask[];

const bodySchema = z.object({
  task: z.enum(TASK_VALUES),
  message: z.string().optional(),
  context: z
    .object({
      page: z
        .enum(["dashboard", "caja", "caja_reportes", "waiting_room", "agenda", "settings", "documentos"])
        .optional(),
      canManageCash: z.boolean().optional(),
      canManageWaitingRoom: z.boolean().optional(),
      canManageSettings: z.boolean().optional(),
      canViewReports: z.boolean().optional(),
    })
    .optional(),
});

/** POST /api/admin-ops-ai — admin/ops orchestrator (Phase G/H). */
export async function POST(request: Request) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!clinicId) {
    return NextResponse.json({ error: "Sin consultorio activo" }, { status: 401 });
  }

  const canUse =
    hasPermission(role, "manageAppointments", isSuperadmin) ||
    hasPermission(role, "manageWaitingRoom", isSuperadmin) ||
    hasPermission(role, "manageCashRegister", isSuperadmin) ||
    hasPermission(role, "manageSettings", isSuperadmin);

  if (!canUse) {
    return NextResponse.json({ error: "Sin permisos operativos" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const payload = parsed.data;
  const result = runAdminOpsOrchestrator({
    task: payload.task,
    message: payload.message,
    context: payload.context,
  });

  return NextResponse.json({ result });
}

export async function GET() {
  const { role, isSuperadmin } = await getActiveClinic();
  const canUse =
    hasPermission(role, "manageAppointments", isSuperadmin) ||
    hasPermission(role, "manageWaitingRoom", isSuperadmin) ||
    hasPermission(role, "manageCashRegister", isSuperadmin) ||
    hasPermission(role, "manageSettings", isSuperadmin);

  if (!canUse) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  return NextResponse.json({
    agents: listAdminOpsAgents(),
    disclaimer: "Asistencia operativa — verificá datos antes de actuar.",
  });
}
