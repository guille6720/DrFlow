import type { DashboardStatKey } from "@/lib/utils/dashboard-stats-types";

export const DASHBOARD_STATS_PANEL_META: Record<
  DashboardStatKey,
  { title: string; description: string; empty: string; actionHref?: string; actionLabel?: string }
> = {
  today: {
    title: "Turnos de hoy",
    description: "Horario, estado y profesional de cada turno del día.",
    empty: "No hay turnos programados para hoy.",
    actionHref: "/agenda",
    actionLabel: "Ver agenda",
  },
  newPatients: {
    title: "Pacientes nuevos este mes",
    description: "Altas registradas desde el inicio del mes.",
    empty: "No hay pacientes nuevos este mes.",
    actionHref: "/pacientes",
    actionLabel: "Ver pacientes",
  },
  consultations: {
    title: "Consultas realizadas este mes",
    description: "Turnos marcados como atendidos en el mes.",
    empty: "Todavía no hay consultas atendidas este mes.",
    actionHref: "/atenciones",
    actionLabel: "Ver atenciones",
  },
  cancelled: {
    title: "Cancelaciones este mes",
    description: "Turnos cancelados con motivo cuando esté registrado.",
    empty: "No hay cancelaciones este mes.",
    actionHref: "/agenda",
    actionLabel: "Ver agenda",
  },
  noShow: {
    title: "Ausentismo",
    description: "Estadísticas semanal y mensual, y pacientes que no asistieron.",
    empty: "No hay ausencias registradas este mes.",
    actionHref: "/atenciones",
    actionLabel: "Ver atenciones",
  },
};
