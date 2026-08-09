import { addDays, parseISO } from "date-fns";

import { clinicDayOfWeek, startOfClinicDay } from "@/shared/utils/clinic-timezone";

export type TurnosMetricAppointment = {
  status: string;
  start_at: string;
  end_at: string;
  is_overbooking?: boolean | null;
};

export type TurnosAvailabilityRule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export type TurnosDashboardMetrics = {
  today: {
    total: number;
    pending: number;
    confirmed: number;
    attended: number;
    cancelled: number;
    noShow: number;
    overbooking: number;
  };
  last30Days: {
    total: number;
    cancelled: number;
    noShow: number;
    attended: number;
    cancellationRate: number;
    noShowRate: number;
  };
  last7Days: {
    bookedMinutes: number;
    capacityMinutes: number;
    occupancyRate: number;
    freeSlotsToday: number;
  };
  byProfessional: Array<{
    professionalId: string;
    professionalName: string;
    count: number;
  }>;
};

function appointmentMinutes(row: TurnosMetricAppointment): number {
  const start = parseISO(row.start_at).getTime();
  const end = parseISO(row.end_at).getTime();
  return Math.max(0, Math.round((end - start) / 60_000));
}

function ruleDayMinutes(rule: TurnosAvailabilityRule): number {
  const [sh, sm] = rule.start_time.slice(0, 5).split(":").map(Number);
  const [eh, em] = rule.end_time.slice(0, 5).split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export function capacityMinutesForRange(
  rules: TurnosAvailabilityRule[],
  fromDate: Date,
  days: number,
  timeZone = "America/Argentina/Buenos_Aires"
): number {
  let total = 0;
  const start = startOfClinicDay(fromDate, timeZone);

  for (let d = 0; d < days; d++) {
    const day = addDays(start, d);
    const dow = clinicDayOfWeek(day, timeZone);
    for (const rule of rules) {
      if (!rule.is_active || rule.day_of_week !== dow) continue;
      total += ruleDayMinutes(rule);
    }
  }

  return total;
}

export function computeTurnosDashboardMetrics(input: {
  appointments: TurnosMetricAppointment[];
  rules: TurnosAvailabilityRule[];
  freeSlotsToday: number;
  professionalCounts: Array<{ professionalId: string; professionalName: string; count: number }>;
  now?: Date;
  timeZone?: string;
}): TurnosDashboardMetrics {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone ?? "America/Argentina/Buenos_Aires";
  const todayStart = startOfClinicDay(now, timeZone);
  const todayEnd = addDays(todayStart, 1);
  const last30Start = addDays(todayStart, -30);
  const last7Start = addDays(todayStart, -7);

  const todayRows = input.appointments.filter((row) => {
    const start = parseISO(row.start_at);
    return start >= todayStart && start < todayEnd;
  });

  const last30Rows = input.appointments.filter((row) => {
    const start = parseISO(row.start_at);
    return start >= last30Start && start < todayEnd;
  });

  const last7Rows = input.appointments.filter((row) => {
    const start = parseISO(row.start_at);
    return start >= last7Start && start < todayEnd && row.status !== "cancelled";
  });

  const countStatus = (rows: TurnosMetricAppointment[], status: string) =>
    rows.filter((row) => row.status === status).length;

  const last30Resolved = last30Rows.filter(
    (row) => row.status === "attended" || row.status === "no_show" || row.status === "cancelled"
  );
  const last30Cancelled = countStatus(last30Rows, "cancelled");
  const last30NoShow = countStatus(last30Rows, "no_show");
  const last30Attended = countStatus(last30Rows, "attended");

  const bookedMinutes = last7Rows.reduce((sum, row) => sum + appointmentMinutes(row), 0);
  const capacityMinutes = capacityMinutesForRange(input.rules, last7Start, 7, timeZone);

  return {
    today: {
      total: todayRows.length,
      pending: countStatus(todayRows, "pending"),
      confirmed: countStatus(todayRows, "confirmed"),
      attended: countStatus(todayRows, "attended"),
      cancelled: countStatus(todayRows, "cancelled"),
      noShow: countStatus(todayRows, "no_show"),
      overbooking: todayRows.filter((row) => row.is_overbooking).length,
    },
    last30Days: {
      total: last30Rows.length,
      cancelled: last30Cancelled,
      noShow: last30NoShow,
      attended: last30Attended,
      cancellationRate:
        last30Resolved.length > 0 ? Math.round((last30Cancelled / last30Resolved.length) * 100) : 0,
      noShowRate:
        last30Attended + last30NoShow > 0
          ? Math.round((last30NoShow / (last30Attended + last30NoShow)) * 100)
          : 0,
    },
    last7Days: {
      bookedMinutes,
      capacityMinutes,
      occupancyRate:
        capacityMinutes > 0 ? Math.round((bookedMinutes / capacityMinutes) * 100) : 0,
      freeSlotsToday: input.freeSlotsToday,
    },
    byProfessional: input.professionalCounts,
  };
}

export function formatRatePercent(value: number): string {
  return `${value}%`;
}
