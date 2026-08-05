import { NextResponse } from "next/server";

import { getActiveClinic, getActiveClinicId } from "@/core/auth/session";
import { withObservabilityApiRoute } from "@/core/observability/api-route";
import { hasPermission } from "@/core/permissions/roles";
import { requireSameOriginMutation } from "@/core/security/csrf";
import { adminOpsAiRequestSchema } from "@/core/validations/admin-ops-ai-api";

import {
  listAdminOpsAgents,
  runAdminOpsOrchestrator,
} from "@/features/dashboard/utils/admin-ops-orchestrator";

/** POST /api/admin-ops-ai — admin/ops orchestrator (Phase G/H). */
export const POST = withObservabilityApiRoute("admin_ops_ai", async (request, ctx) => {
  const csrfBlock = requireSameOriginMutation(request);
  if (csrfBlock) return csrfBlock;

  const clinicId = await getActiveClinicId();
  ctx.clinicId = clinicId;
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

  const parsed = adminOpsAiRequestSchema.safeParse(json);
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
});

export const GET = withObservabilityApiRoute("admin_ops_ai_meta", async (_request, ctx) => {
  const clinicId = await getActiveClinicId();
  ctx.clinicId = clinicId;
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
});
