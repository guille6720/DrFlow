"use client";

import { useMemo, useState } from "react";
import { DASHBOARD_STATS_PANEL_META } from "@/components/dashboard/dashboard-stats-panel-meta";
import type { DashboardStatKey, DashboardStatRow, DashboardStatsDetail } from "@/lib/utils/dashboard-stats-types";

type Options = {
  detail: DashboardStatsDetail;
};

export function useDashboardStatsSection({ detail }: Options) {
  const [activeKey, setActiveKey] = useState<DashboardStatKey | null>(null);
  const [query, setQuery] = useState("");

  const toggle = (key: DashboardStatKey) => {
    setActiveKey((current) => (current === key ? null : key));
    setQuery("");
  };

  const activeRows = useMemo((): DashboardStatRow[] => {
    if (!activeKey) return [];
    switch (activeKey) {
      case "today":
        return detail.todayAppointments;
      case "newPatients":
        return detail.newPatients;
      case "consultations":
        return detail.attendedConsultations;
      case "cancelled":
        return detail.cancelledAppointments;
      case "noShow":
        return detail.noShowAppointments;
      default:
        return [];
    }
  }, [activeKey, detail]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter((row) => {
      const blob = `${row.patientName} ${row.documentNumber ?? ""} ${row.detail ?? ""} ${row.professionalName ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [activeRows, query]);

  const activeMeta = activeKey ? DASHBOARD_STATS_PANEL_META[activeKey] : null;
  const totalForActive =
    activeKey === "today"
      ? detail.counts.todayAppointments
      : activeKey === "newPatients"
        ? detail.counts.newPatients
        : activeKey === "consultations"
          ? detail.counts.completedConsultations
          : activeKey === "cancelled"
            ? detail.counts.cancelledAppointments
            : activeKey === "noShow"
              ? detail.counts.noShowCount
              : 0;

  return {
    activeKey,
    toggle,
    query,
    setQuery,
    activeRows,
    filteredRows,
    activeMeta,
    totalForActive,
    weekly: detail.absenteeism.weekly,
    monthly: detail.absenteeism.monthly,
    counts: detail.counts,
  };
}
