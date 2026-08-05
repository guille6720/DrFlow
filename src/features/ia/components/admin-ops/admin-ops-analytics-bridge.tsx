"use client";

import { useEffect } from "react";

import type { AdminOpsPageHint } from "@/features/dashboard/utils/admin-ops-types";
import { useAdminOpsCopilot } from "@/features/ia/components/admin-ops/admin-ops-copilot-context";

import type { AdminAnalyticsSnapshot } from "@/lib/utils/admin-analytics-types";

type Props = {
  analytics: AdminAnalyticsSnapshot;
  page?: AdminOpsPageHint;
  canManageCash?: boolean;
  canViewReports?: boolean;
};

/** Syncs caja/revenue analytics into the admin/ops copilot session (Phase H). */
export function AdminOpsAnalyticsBridge({
  analytics,
  page = "caja",
  canManageCash,
  canViewReports,
}: Props) {
  const { setSession } = useAdminOpsCopilot();

  useEffect(() => {
    setSession({
      page,
      analytics,
      canManageCash,
      canViewReports,
    });
  }, [analytics, page, canManageCash, canViewReports, setSession]);

  return null;
}
