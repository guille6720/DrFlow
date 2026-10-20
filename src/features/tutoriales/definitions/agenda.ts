import { buildStandardModuleTutorial } from "@/features/tutoriales/definitions/build-module-tutorial";
import { TOUR_TARGETS } from "@/features/tutoriales/targets";
import type { TutorialDefinition } from "@/features/tutoriales/types";

/**
 * Agenda / Turnos — first complete NexClinic tutorial.
 * Targets match data-tour on /turnos/agenda (AgendaToolbar + AgendaView).
 */
const generated = buildStandardModuleTutorial({
  moduleId: "agenda",
  startRoute: "/turnos/agenda",
  titleName: "Agenda de turnos",
  title: "Agenda: primeros pasos",
  description:
    "Conocé la agenda real de NexClinic: vistas, navegación de fechas, filtros y acceso a Nuevo turno. Demostración: no crea ni modifica turnos.",
  estimatedMinutes: 5,
  version: 1,
  audienceRoles: ["superadmin", "clinic_admin", "doctor", "secretary"],
  actions: [
    {
      id: "view-toggle",
      title: "Cambiar la vista",
      body: "Usá Día, Semana o Mes para cambiar cómo se muestran los turnos. El tutorial solo señala el control; no cambia tu vista por vos.",
      narration:
        "En la barra superior de la agenda están las vistas Día, Semana y Mes. Elegí la que te resulte más cómoda para organizar la atención del día.",
      caption: "Vistas Día · Semana · Mes",
      placement: "bottom",
      durationSec: 14,
    },
    {
      id: "week-nav",
      title: "Navegar fechas",
      body: "Con las flechas y el botón Hoy podés moverte entre días o semanas sin salir de la agenda.",
      narration:
        "Las flechas te llevan al período anterior o siguiente, y el botón Hoy vuelve a la fecha actual. Así revisás la agenda sin perder el contexto.",
      caption: "Anterior · Hoy · Siguiente",
      placement: "bottom",
      durationSec: 14,
    },
    {
      id: "filter-professional",
      title: "Filtrar por médico",
      body: "El filtro Médico limita los turnos visibles al profesional seleccionado. También hay filtros de especialidad y sede cuando aplica.",
      narration:
        "El filtro de médico te permite concentrarte en la agenda de un profesional. Si lo dejás en Todos, ves el consultorio completo.",
      caption: "Filtro por médico",
      placement: "top",
      durationSec: 15,
    },
    {
      id: "new-button",
      title: "Ubicar Nuevo turno",
      body: "El botón Nuevo turno abre el asistente de alta. Esta demostración no lo presiona ni guarda registros reales.",
      narration:
        "Cuando tu perfil tiene permiso de agenda, el botón Nuevo turno inicia el asistente de creación. En esta demostración solo lo señalamos: no se guarda ningún turno real.",
      caption: "Demostración: no se guardan turnos",
      placement: "bottom",
      durationSec: 14,
      requirePermission: "manageAppointments",
    },
  ],
});

/** Override welcome/closing targets to the stable agenda-header tour id. */
export const AGENDA_BASICO_TUTORIAL: TutorialDefinition = {
  ...generated,
  steps: generated.steps.map((step) => {
    if (step.id === "welcome" || step.id === "closing") {
      return { ...step, target: TOUR_TARGETS.AGENDA_HEADER };
    }
    if (step.id === "view-toggle") {
      return { ...step, target: TOUR_TARGETS.AGENDA_VIEW_TOGGLE };
    }
    if (step.id === "week-nav") {
      return { ...step, target: TOUR_TARGETS.AGENDA_WEEK_NAV };
    }
    if (step.id === "filter-professional") {
      return { ...step, target: TOUR_TARGETS.AGENDA_FILTER_PROFESSIONAL };
    }
    if (step.id === "new-button") {
      return { ...step, target: TOUR_TARGETS.AGENDA_NEW_BUTTON };
    }
    return step;
  }),
};
