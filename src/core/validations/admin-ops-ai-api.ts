import { z } from "zod";

import type { AdminOpsTask } from "@/features/dashboard/utils/admin-ops-orchestrator";

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

export const adminOpsAiRequestSchema = z.object({
  task: z.enum(TASK_VALUES),
  message: z.string().max(8000).optional(),
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

export type AdminOpsAiRequest = z.infer<typeof adminOpsAiRequestSchema>;
