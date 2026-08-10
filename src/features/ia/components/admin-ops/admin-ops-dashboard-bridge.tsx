"use client";

import { useEffect } from "react";

import {
  type AdminOpsContext,
  buildAdminOpsSnapshotFromDashboard,
} from "@/features/dashboard/utils/admin-ops-types";
import type { ClinicalOperationsDashboardCorePayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import type { ClinicalOperationsDashboardPayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import { useAdminOpsCopilot } from "@/features/ia/components/admin-ops/admin-ops-copilot-context";

type Props = {
  ops: ClinicalOperationsDashboardPayload | ClinicalOperationsDashboardCorePayload;
  canManageCash?: boolean;
  canManageWaitingRoom?: boolean;
  canManageSettings?: boolean;
};

/** Syncs dashboard ops payload into the admin/ops copilot session. */
export function AdminOpsDashboardBridge({
  ops,
  canManageCash,
  canManageWaitingRoom,
  canManageSettings,
}: Props) {
  const { setSession } = useAdminOpsCopilot();

  useEffect(() => {
    const next: AdminOpsContext = {
      page: "dashboard",
      ops: buildAdminOpsSnapshotFromDashboard(ops),
      canManageCash,
      canManageWaitingRoom,
      canManageSettings,
    };
    setSession(next);
  }, [ops, canManageCash, canManageWaitingRoom, canManageSettings, setSession]);

  return null;
}
