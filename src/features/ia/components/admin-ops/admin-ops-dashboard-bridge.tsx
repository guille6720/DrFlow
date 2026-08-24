"use client";

import { useEffect } from "react";

import { useEntitlementsSnapshot } from "@/core/components/entitlements/entitlements-provider";

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
  const entitlementsSnapshot = useEntitlementsSnapshot();

  useEffect(() => {
    const next: AdminOpsContext = {
      page: "dashboard",
      ops: buildAdminOpsSnapshotFromDashboard(ops),
      canManageCash,
      canManageWaitingRoom,
      canManageSettings,
      entitlementsSnapshot,
    };
    setSession(next);
  }, [
    ops,
    canManageCash,
    canManageWaitingRoom,
    canManageSettings,
    entitlementsSnapshot,
    setSession,
  ]);

  return null;
}
