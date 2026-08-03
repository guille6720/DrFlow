import type { AbsenteeismPeriodSummary } from "@/lib/utils/absenteeism-stats";

export type DashboardStatKey =
  | "today"
  | "newPatients"
  | "consultations"
  | "cancelled"
  | "noShow";

export type DashboardStatRow = {
  id: string;
  patientId: string;
  patientName: string;
  documentNumber?: string;
  dateLabel: string;
  timeLabel?: string;
  statusLabel?: string;
  detail?: string;
  professionalName?: string;
  href: string;
};

export type DashboardStatsDetail = {
  todayAppointments: DashboardStatRow[];
  newPatients: DashboardStatRow[];
  attendedConsultations: DashboardStatRow[];
  cancelledAppointments: DashboardStatRow[];
  noShowAppointments: DashboardStatRow[];
  absenteeism: {
    weekly: AbsenteeismPeriodSummary;
    monthly: AbsenteeismPeriodSummary;
  };
  counts: {
    todayAppointments: number;
    newPatients: number;
    completedConsultations: number;
    cancelledAppointments: number;
    noShowCount: number;
    totalMonthAppointments: number;
  };
};
