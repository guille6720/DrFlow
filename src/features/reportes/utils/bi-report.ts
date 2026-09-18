export type BiPeriod = "daily" | "weekly" | "monthly";

export type BiCountRow = {
  count: number;
  pct?: number;
};

export type BiCoverageRow = BiCountRow & { coverage: string };
export type BiSpecialtyRow = BiCountRow & { specialty: string };
export type BiLocationRow = BiCountRow & { location: string };
export type BiCrossRow = { specialty: string; coverage: string; count: number };

export type BiAppointmentStats = {
  total_scheduled: number;
  attended: number;
  no_show: number;
  cancelled: number;
  presencial: number;
  virtual: number;
  attendance_rate: number;
};

export type ClinicBiReport = {
  attended_total: number;
  unique_coverages: number;
  unique_specialties: number;
  appointment_stats: BiAppointmentStats;
  by_coverage: BiCoverageRow[];
  by_specialty: BiSpecialtyRow[];
  by_specialty_coverage: BiCrossRow[];
  by_location: BiLocationRow[];
};

export function emptyClinicBiReport(): ClinicBiReport {
  return {
    attended_total: 0,
    unique_coverages: 0,
    unique_specialties: 0,
    appointment_stats: {
      total_scheduled: 0,
      attended: 0,
      no_show: 0,
      cancelled: 0,
      presencial: 0,
      virtual: 0,
      attendance_rate: 0,
    },
    by_coverage: [],
    by_specialty: [],
    by_specialty_coverage: [],
    by_location: [],
  };
}

export function parseBiReportPeriod(value?: string | null): BiPeriod {
  if (value === "daily" || value === "weekly" || value === "monthly") return value;
  return "monthly";
}

export function buildBiReportCsv(report: ClinicBiReport, periodLabel: string): string[][] {
  const rows: string[][] = [
    ["Reporte BI NexClinic", periodLabel],
    [],
    ["Métrica", "Valor"],
    ["Turnos programados", String(report.appointment_stats.total_scheduled)],
    ["Atenciones", String(report.appointment_stats.attended)],
    ["Tasa asistencia (%)", String(report.appointment_stats.attendance_rate)],
    ["Ausentismo", String(report.appointment_stats.no_show)],
    ["Cancelaciones", String(report.appointment_stats.cancelled)],
    ["Presencial", String(report.appointment_stats.presencial)],
    ["Virtual", String(report.appointment_stats.virtual)],
    [],
    ["Cobertura", "Atenciones", "%"],
    ...report.by_coverage.map((r) => [r.coverage, String(r.count), String(r.pct ?? 0)]),
    [],
    ["Especialidad", "Atenciones", "%"],
    ...report.by_specialty.map((r) => [r.specialty, String(r.count), String(r.pct ?? 0)]),
    [],
    ["Especialidad", "Cobertura", "Atenciones"],
    ...report.by_specialty_coverage.map((r) => [r.specialty, r.coverage, String(r.count)]),
    [],
    ["Sede", "Atenciones", "%"],
    ...report.by_location.map((r) => [r.location, String(r.count), String(r.pct ?? 0)]),
  ];
  return rows;
}

export function buildBiReportUrl(period: BiPeriod): string {
  return `/reportes/bi?period=${period}`;
}

export function topBiRows<T extends { count: number }>(rows: T[], limit = 8): T[] {
  return [...rows].sort((a, b) => b.count - a.count).slice(0, limit);
}
