import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, parseISO } from "date-fns";

import { generateAvailableSlots } from "@/core/booking/slots";

import { startOfClinicDay } from "@/shared/utils/clinic-timezone";

import {
  capacityMinutesForRange,
  computePeriodReportMetrics,
  computeTurnosDashboardMetrics,
  type TurnosDashboardMetrics,
  type TurnosMetricAppointment,
  type TurnosPeriodReportMetrics,
  type TurnosReportPeriod,
  turnosReportPeriodDays,
} from "@/features/turnos/utils/turnos-metrics";

import {
  getCachedClinicProfessionalsAgenda,
  getCachedClinicSettings,
} from "@/lib/server/cached-clinic-queries";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export type TurnosConfigRuleRow = {
  id: string;
  professional_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration: number;
  is_active: boolean;
  professional_name: string;
};

export type TurnosConfigBlockRow = {
  id: string;
  professional_id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  professional_name: string;
};

export async function loadTurnosConfigPageData(supabase: SupabaseClient, clinicId: string) {
  const now = new Date();
  const blocksFrom = startOfClinicDay(now).toISOString();

  const [{ data: rules }, { data: blocks }, professionals, clinic] = await Promise.all([
      supabase
        .from("availability_rules")
        .select(
          "id, professional_id, day_of_week, start_time, end_time, slot_duration, is_active, professionals(display_name, profiles(full_name))"
        )
        .eq("clinic_id", clinicId)
        .order("day_of_week")
        .order("start_time"),
      supabase
        .from("schedule_blocks")
        .select(
          "id, professional_id, start_at, end_at, reason, professionals(display_name, profiles(full_name))"
        )
        .eq("clinic_id", clinicId)
        .gte("start_at", blocksFrom)
        .order("start_at"),
      getCachedClinicProfessionalsAgenda(clinicId),
      getCachedClinicSettings(clinicId),
    ]);

  const mappedRules: TurnosConfigRuleRow[] = (rules ?? []).map((row) => {
    const professional = row.professionals as {
      display_name?: string | null;
      profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null;
    } | null;
    return {
      id: row.id,
      professional_id: row.professional_id,
      day_of_week: row.day_of_week,
      start_time: String(row.start_time).slice(0, 5),
      end_time: String(row.end_time).slice(0, 5),
      slot_duration: row.slot_duration,
      is_active: row.is_active,
      professional_name: getProfessionalDisplayName(professional ?? {}),
    };
  });

  const mappedBlocks: TurnosConfigBlockRow[] = (blocks ?? []).map((row) => {
    const professional = row.professionals as {
      display_name?: string | null;
      profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null;
    } | null;
    return {
      id: row.id,
      professional_id: row.professional_id,
      start_at: row.start_at,
      end_at: row.end_at,
      reason: row.reason,
      professional_name: getProfessionalDisplayName(professional ?? {}),
    };
  });

  return {
    rules: mappedRules,
    blocks: mappedBlocks,
    professionals: (professionals ?? []).map((p) => ({
      id: p.id,
      name: getProfessionalDisplayName(p),
    })),
    defaultDuration: clinic?.default_appointment_duration ?? 30,
    dayNames: DAY_NAMES,
  };
}

export async function loadTurnosReportesPageData(supabase: SupabaseClient, clinicId: string) {
  const now = new Date();
  const todayStart = startOfClinicDay(now);
  const todayEnd = addDays(todayStart, 1);
  const last7Start = addDays(todayStart, -7);
  const rangeStart = addDays(todayStart, -30);
  const rangeEnd = todayEnd;

  const [
    rpcResult,
    { data: rules },
    professionals,
    clinic,
    { data: todayAppointments },
    { data: todayBlocks },
    fallbackAppointments,
  ] = await Promise.all([
    supabase.rpc("summarize_appointments_for_turnos_reportes", {
      p_clinic_id: clinicId,
      p_range_start: rangeStart.toISOString(),
      p_range_end: rangeEnd.toISOString(),
      p_today_start: todayStart.toISOString(),
      p_today_end: todayEnd.toISOString(),
      p_last7_start: last7Start.toISOString(),
    }),
    supabase
      .from("availability_rules")
      .select("day_of_week, start_time, end_time, slot_duration, is_active, professional_id")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    getCachedClinicProfessionalsAgenda(clinicId),
    getCachedClinicSettings(clinicId),
    supabase
      .from("appointments")
      .select("professional_id, start_at, end_at")
      .eq("clinic_id", clinicId)
      .neq("status", "cancelled")
      .gte("start_at", todayStart.toISOString())
      .lt("start_at", todayEnd.toISOString()),
    supabase
      .from("schedule_blocks")
      .select("start_at, end_at, professional_id")
      .eq("clinic_id", clinicId)
      .gte("start_at", todayStart.toISOString())
      .lt("start_at", todayEnd.toISOString()),
    supabase
      .from("appointments")
      .select("id, status, start_at, end_at, is_overbooking, professional_id")
      .eq("clinic_id", clinicId)
      .gte("start_at", rangeStart.toISOString())
      .lt("start_at", rangeEnd.toISOString()),
  ]);

  const defaultSlotDuration = clinic?.default_appointment_duration ?? 30;
  const mappedRules = (rules ?? []).map((rule) => ({
    day_of_week: rule.day_of_week,
    start_time: String(rule.start_time),
    end_time: String(rule.end_time),
    is_active: rule.is_active,
  }));

  let freeSlotsToday = 0;
  for (const professional of professionals ?? []) {
    const proRules = (rules ?? []).filter((rule) => rule.professional_id === professional.id);
    const proAppointments = (todayAppointments ?? []).filter(
      (row) => row.professional_id === professional.id
    );
    const proBlocks = (todayBlocks ?? []).filter(
      (block) => !block.professional_id || block.professional_id === professional.id
    );

    freeSlotsToday += generateAvailableSlots({
      rules: proRules.map((rule) => ({
        day_of_week: rule.day_of_week,
        start_time: String(rule.start_time).slice(0, 5),
        end_time: String(rule.end_time).slice(0, 5),
        slot_duration: rule.slot_duration ?? defaultSlotDuration,
      })),
      appointments: proAppointments,
      blocks: proBlocks,
      daysAhead: 1,
      fromDate: now,
    }).length;
  }

  let metrics: TurnosDashboardMetrics;

  if (!rpcResult.error && rpcResult.data && typeof rpcResult.data === "object") {
    const summary = rpcResult.data as {
      today: TurnosDashboardMetrics["today"];
      last30_days: {
        total: number;
        cancelled: number;
        no_show: number;
        attended: number;
      };
      last7_booked_minutes: number;
      by_professional_today: Array<{ professional_id: string; count: number }>;
    };

    const last30Resolved =
      summary.last30_days.cancelled + summary.last30_days.no_show + summary.last30_days.attended;
    const capacityMinutes = capacityMinutesForRange(mappedRules, last7Start, 7);

    const countsByPro = new Map(
      (summary.by_professional_today ?? []).map((row) => [row.professional_id, row.count])
    );

    metrics = {
      today: summary.today,
      last30Days: {
        total: summary.last30_days.total,
        cancelled: summary.last30_days.cancelled,
        noShow: summary.last30_days.no_show,
        attended: summary.last30_days.attended,
        cancellationRate:
          last30Resolved > 0
            ? Math.round((summary.last30_days.cancelled / last30Resolved) * 100)
            : 0,
        noShowRate:
          summary.last30_days.attended + summary.last30_days.no_show > 0
            ? Math.round(
                (summary.last30_days.no_show /
                  (summary.last30_days.attended + summary.last30_days.no_show)) *
                  100
              )
            : 0,
      },
      last7Days: {
        bookedMinutes: Number(summary.last7_booked_minutes ?? 0),
        capacityMinutes,
        occupancyRate:
          capacityMinutes > 0
            ? Math.round((Number(summary.last7_booked_minutes ?? 0) / capacityMinutes) * 100)
            : 0,
        freeSlotsToday,
      },
      byProfessional: (professionals ?? []).map((professional) => ({
        professionalId: professional.id,
        professionalName: getProfessionalDisplayName(professional),
        count: countsByPro.get(professional.id) ?? 0,
      })),
    };
  } else {
    const appointments = (fallbackAppointments.data ?? []) as TurnosMetricAppointment[];
    const professionalCounts = (professionals ?? []).map((professional) => {
      const count = appointments.filter(
        (row) =>
          row.professional_id === professional.id &&
          parseISO(row.start_at) >= todayStart &&
          parseISO(row.start_at) < todayEnd
      ).length;
      return {
        professionalId: professional.id,
        professionalName: getProfessionalDisplayName(professional),
        count,
      };
    });

    metrics = computeTurnosDashboardMetrics({
      appointments,
      rules: mappedRules,
      freeSlotsToday,
      professionalCounts,
      now,
    });
  }

  return { metrics };
}

export async function loadTurnosPeriodReportData(
  supabase: SupabaseClient,
  clinicId: string,
  period: TurnosReportPeriod
): Promise<{ metrics: TurnosPeriodReportMetrics }> {
  const now = new Date();
  const todayStart = startOfClinicDay(now);
  const todayEnd = addDays(todayStart, 1);
  const days = turnosReportPeriodDays(period);
  const rangeStart = addDays(todayStart, -days);

  const [{ data: rules }, professionals, { data: appointments }] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("day_of_week, start_time, end_time, slot_duration, is_active, professional_id")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    getCachedClinicProfessionalsAgenda(clinicId),
    supabase
      .from("appointments")
      .select("id, status, start_at, end_at, is_overbooking, professional_id")
      .eq("clinic_id", clinicId)
      .gte("start_at", rangeStart.toISOString())
      .lt("start_at", todayEnd.toISOString()),
  ]);

  const mappedRules = (rules ?? []).map((rule) => ({
    day_of_week: rule.day_of_week,
    start_time: String(rule.start_time),
    end_time: String(rule.end_time),
    is_active: rule.is_active,
  }));

  const metrics = computePeriodReportMetrics({
    appointments: (appointments ?? []) as TurnosMetricAppointment[],
    rules: mappedRules,
    period,
    professionals: (professionals ?? []).map((professional) => ({
      id: professional.id,
      name: getProfessionalDisplayName(professional),
    })),
    now,
  });

  return { metrics };
}
