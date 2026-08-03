import { appointmentStatusBadge } from "@/components/ui/badge";
import { absenteeismRate } from "@/lib/utils/absenteeism-stats";
import { getAttendancePeriodBounds } from "@/lib/utils/attendance-stats";
import { formatClinicDateTime } from "@/lib/utils/clinic-timezone";
import type { DashboardStatRow, DashboardStatsDetail } from "@/lib/utils/dashboard-stats-types";

type PatientRef = {
  first_name: string;
  last_name: string;
  document_number?: string | null;
};

type AppointmentDetailRow = {
  id: string;
  start_at: string;
  status: string;
  patient_id: string;
  cancellation_reason?: string | null;
  patients?: PatientRef | PatientRef[] | null;
  professionals?:
    | { profiles?: { full_name?: string } | { full_name?: string }[] | null }
    | { profiles?: { full_name?: string } | { full_name?: string }[] | null }[]
    | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type NormalizedAppointmentDetailRow = {
  id: string;
  start_at: string;
  status: string;
  patient_id: string;
  cancellation_reason?: string | null;
  patients?: PatientRef | null;
  professionals?: { profiles?: { full_name?: string } | null } | null;
};

function normalizeAppointmentRow(row: AppointmentDetailRow): NormalizedAppointmentDetailRow {
  const patient = firstRelation(row.patients);
  const professional = firstRelation(row.professionals);
  const profile = firstRelation(professional?.profiles ?? null);

  return {
    id: row.id,
    start_at: row.start_at,
    status: row.status,
    patient_id: row.patient_id,
    cancellation_reason: row.cancellation_reason,
    patients: patient,
    professionals: profile ? { profiles: profile } : null,
  };
}

type NewPatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  created_at: string;
};

function formatPatientName(patient: PatientRef | null | undefined): string {
  if (!patient) return "Sin paciente";
  return `${patient.last_name}, ${patient.first_name}`;
}

function mapAppointmentRow(
  row: NormalizedAppointmentDetailRow,
  timeZone: string,
  options?: { includeStatus?: boolean; detail?: string }
): DashboardStatRow {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: formatPatientName(row.patients),
    documentNumber: row.patients?.document_number ?? undefined,
    dateLabel: formatClinicDateTime(row.start_at, "d MMM yyyy", timeZone),
    timeLabel: formatClinicDateTime(row.start_at, "HH:mm 'hs'", timeZone),
    statusLabel: options?.includeStatus
      ? (appointmentStatusBadge[row.status]?.label ?? row.status)
      : undefined,
    detail: options?.detail ?? row.cancellation_reason ?? undefined,
    professionalName: row.professionals?.profiles?.full_name ?? undefined,
    href: `/pacientes/${row.patient_id}`,
  };
}

function mapNewPatientRow(row: NewPatientRow, timeZone: string): DashboardStatRow {
  return {
    id: row.id,
    patientId: row.id,
    patientName: `${row.last_name}, ${row.first_name}`,
    documentNumber: row.document_number,
    dateLabel: formatClinicDateTime(row.created_at, "d MMM yyyy", timeZone),
    timeLabel: formatClinicDateTime(row.created_at, "HH:mm 'hs'", timeZone),
    href: `/pacientes/${row.id}`,
  };
}

const STATUS_SORT: Record<string, number> = {
  attended: 0,
  confirmed: 1,
  pending: 2,
  no_show: 3,
  cancelled: 4,
};

export function buildDashboardStatsDetail(input: {
  timeZone: string;
  referenceDate?: Date;
  todayAppointments: AppointmentDetailRow[];
  newPatients: NewPatientRow[];
  attendedConsultations: AppointmentDetailRow[];
  cancelledAppointments: AppointmentDetailRow[];
  noShowAppointments: AppointmentDetailRow[];
  weekNoShowCount: number;
  weekTotalAppointments: number;
  counts: DashboardStatsDetail["counts"];
}): DashboardStatsDetail {
  const referenceDate = input.referenceDate ?? new Date();
  const weeklyBounds = getAttendancePeriodBounds("weekly", referenceDate, input.timeZone);
  const monthlyBounds = getAttendancePeriodBounds("monthly", referenceDate, input.timeZone);

  const sortedToday = [...input.todayAppointments].map(normalizeAppointmentRow).sort((a, b) => {
    const statusDiff = (STATUS_SORT[a.status] ?? 99) - (STATUS_SORT[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return a.start_at.localeCompare(b.start_at);
  });

  return {
    todayAppointments: sortedToday.map((row) =>
      mapAppointmentRow(row, input.timeZone, { includeStatus: true })
    ),
    newPatients: input.newPatients.map((row) => mapNewPatientRow(row, input.timeZone)),
    attendedConsultations: input.attendedConsultations.map((row) =>
      mapAppointmentRow(normalizeAppointmentRow(row), input.timeZone)
    ),
    cancelledAppointments: input.cancelledAppointments.map((row) =>
      mapAppointmentRow(normalizeAppointmentRow(row), input.timeZone, {
        detail: row.cancellation_reason ?? undefined,
      })
    ),
    noShowAppointments: input.noShowAppointments.map((row) =>
      mapAppointmentRow(normalizeAppointmentRow(row), input.timeZone)
    ),
    absenteeism: {
      weekly: {
        label: weeklyBounds.label,
        noShowCount: input.weekNoShowCount,
        totalAppointments: input.weekTotalAppointments,
        rate: absenteeismRate(input.weekNoShowCount, input.weekTotalAppointments),
      },
      monthly: {
        label: monthlyBounds.label,
        noShowCount: input.counts.noShowCount,
        totalAppointments: input.counts.totalMonthAppointments,
        rate: absenteeismRate(input.counts.noShowCount, input.counts.totalMonthAppointments),
      },
    },
    counts: input.counts,
  };
}
