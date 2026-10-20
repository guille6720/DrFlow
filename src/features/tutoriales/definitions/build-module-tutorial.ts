import { moduleActionTarget, moduleTourTargets } from "@/features/tutoriales/targets";
import type {
  TutorialAudienceRole,
  TutorialDefinition,
  TutorialStep,
  VideoScene,
} from "@/features/tutoriales/types";

export interface ModuleActionSpec {
  id: string;
  title: string;
  body: string;
  narration: string;
  caption?: string;
  route?: string;
  placement?: TutorialStep["placement"];
  durationSec?: number;
  durationMs?: number;
  requirePermission?: string;
}

export interface StandardModuleTutorialSpec {
  moduleId: string;
  startRoute: string;
  titleName: string;
  title?: string;
  description: string;
  actions: ModuleActionSpec[];
  estimatedMinutes?: number;
  audienceRoles?: TutorialAudienceRole[];
  version?: number;
}

const DEFAULT_ROLES: TutorialAudienceRole[] = [
  "superadmin",
  "clinic_admin",
  "doctor",
  "secretary",
];

/**
 * Builds welcome → actions → closing with spotlight + narration + auto-advance.
 */
export function buildStandardModuleTutorial(
  spec: StandardModuleTutorialSpec
): TutorialDefinition {
  const targets = moduleTourTargets(spec.moduleId);
  const name = spec.titleName;
  const title = spec.title ?? `${name}: primeros pasos`;
  const roles = spec.audienceRoles ?? DEFAULT_ROLES;
  const minutes = spec.estimatedMinutes ?? Math.max(5, 2 + spec.actions.length);
  const actions = spec.actions;

  const videoScenes: VideoScene[] = [
    {
      id: "v-intro",
      order: 1,
      title: "Introducción",
      narration: `Bienvenido a ${name} de NexClinic. En este recorrido vas a ver, paso a paso, cómo realizar cada acción importante del módulo.`,
      caption: `${name} NexClinic — primeros pasos`,
      durationSec: 8,
    },
    ...actions.map((action, index) => ({
      id: `v-${action.id}`,
      order: index + 2,
      title: action.title,
      narration: action.narration,
      caption: action.caption ?? action.title,
      durationSec: action.durationSec ?? 14,
    })),
    {
      id: "v-outro",
      order: actions.length + 2,
      title: "Cierre",
      narration: `Listo. Ya viste cómo hacer las acciones principales de ${name}. Volvé a Tutoriales NexClinic cuando quieras practicar de nuevo.`,
      caption: "Tutoriales NexClinic",
      durationSec: 8,
    },
  ];

  const actionSteps: TutorialStep[] = actions.map((action) => ({
    id: action.id,
    title: action.title,
    body: action.body,
    target: moduleActionTarget(spec.moduleId, action.id),
    placement: action.placement ?? "top",
    route: action.route ?? spec.startRoute,
    videoSceneId: `v-${action.id}`,
    narration: action.narration,
    caption: action.caption ?? action.title,
    validation: action.requirePermission
      ? { requirePermission: action.requirePermission }
      : undefined,
    animation: {
      preset: "cursor-highlight",
      durationMs: action.durationMs ?? 3400,
      cursor: true,
      spotlightPulse: true,
    },
  }));

  return {
    id: `${spec.moduleId}-basico`,
    moduleId: spec.moduleId,
    version: spec.version ?? 1,
    title,
    description: spec.description,
    audienceRoles: roles,
    estimatedMinutes: minutes,
    difficulty: "basico",
    startRoute: spec.startRoute,
    demoScenes: [
      {
        id: "demo-welcome",
        headline: "Demostración segura",
        body: `Esta demo de ${name} usa solo datos ficticios. No crea ni modifica registros reales.`,
        mockLabels: {
          clinica: "Clínica Demo NexClinic",
          modulo: name,
        },
        durationMs: 4200,
        narration: `Esta es una demostración segura de ${name} en Tutoriales NexClinic. Todo lo que vas a ver es ficticio: no se crea ni se modifica ningún dato real de tu clínica.`,
        animation: {
          preset: "cursor-highlight",
          durationMs: 2800,
          cursor: true,
          spotlightPulse: true,
        },
      },
    ],
    videoScenes,
    steps: [
      {
        id: "welcome",
        title: `Bienvenida a ${name}`,
        body: `Este recorrido te muestra, acción por acción, cómo usar ${name} en NexClinic. Solo se resalta lo que ya existe en el sistema.`,
        target: targets.header,
        placement: "bottom",
        route: spec.startRoute,
        demoSceneId: "demo-welcome",
        videoSceneId: "v-intro",
        narration: `Bienvenido a ${name} de NexClinic. Ahora te voy a mostrar cómo realizar cada acción del módulo, paso a paso.`,
        caption: `Bienvenida a ${name}`,
        animation: {
          preset: "cursor-highlight",
          durationMs: 2800,
          cursor: true,
          spotlightPulse: true,
        },
      },
      ...actionSteps,
      {
        id: "closing",
        title: "Listo para practicar",
        body: `Ya recorriste las acciones principales de ${name}. Podés reiniciar el tutorial desde Tutoriales NexClinic cuando quieras.`,
        target: targets.header,
        placement: "bottom",
        route: spec.startRoute,
        videoSceneId: "v-outro",
        narration: `Listo. Practicá ${name} cuando lo necesites desde Tutoriales NexClinic. Gracias por usar NexClinic.`,
        caption: "Tutorial completado",
        animation: {
          preset: "intro-logo",
          durationMs: 2600,
          cursor: false,
          spotlightPulse: false,
        },
      },
    ],
  };
}
