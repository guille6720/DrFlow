"use client";

import { useEffect } from "react";
import { useAdminOpsCopilot } from "@/components/admin-ops/admin-ops-copilot-context";
import {
  buildAdminOpsSnapshotFromDashboard,
  type AdminOpsContext,
} from "@/lib/utils/admin-ops-types";
import type { ClinicalOperationsDashboardPayload } from "@/lib/utils/clinical-operations-dashboard-types";

type Props = {
  ops: ClinicalOperationsDashboardPayload;
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
