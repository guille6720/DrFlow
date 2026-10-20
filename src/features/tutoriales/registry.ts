import { AGENDA_BASICO_TUTORIAL } from "@/features/tutoriales/definitions/agenda";
import { CLINIC_MODULE_TUTORIALS } from "@/features/tutoriales/definitions/clinic-modules";
import type {
  AcademyModuleCard,
  TutorialAudienceRole,
  TutorialDefinition,
  TutorialProgress,
} from "@/features/tutoriales/types";

/**
 * Registered tutorials for operational clinic modules.
 * Superadmin and empty Geriatría shells are intentionally excluded.
 */
const TUTORIALS: TutorialDefinition[] = [AGENDA_BASICO_TUTORIAL, ...CLINIC_MODULE_TUTORIALS];

const byId = new Map(TUTORIALS.map((t) => [t.id, t]));

export function listTutorials(): TutorialDefinition[] {
  return [...TUTORIALS];
}

export function getTutorialById(id: string): TutorialDefinition | null {
  return byId.get(id) ?? null;
}

export function listTutorialsForRole(role: TutorialAudienceRole): TutorialDefinition[] {
  return TUTORIALS.filter((t) => t.audienceRoles.includes(role));
}

export function buildAcademyCards(
  role: TutorialAudienceRole,
  progressByTutorial: Record<string, TutorialProgress | undefined>,
  options?: {
    /** When false, hide tutorials whose startRoute needs manageAppointments-like gates. */
    canAccessStartRoute?: (startRoute: string) => boolean;
  }
): AcademyModuleCard[] {
  const canAccess = options?.canAccessStartRoute ?? (() => true);
  return listTutorialsForRole(role)
    .filter((tutorial) => canAccess(tutorial.startRoute))
    .map((tutorial) => ({
      tutorialId: tutorial.id,
      moduleId: tutorial.moduleId,
      title: tutorial.title,
      description: tutorial.description,
      estimatedMinutes: tutorial.estimatedMinutes,
      difficulty: tutorial.difficulty,
      startRoute: tutorial.startRoute,
      stepTitles: tutorial.steps.map((s) => s.title),
      stepCount: tutorial.steps.length,
      progress: progressByTutorial[tutorial.id] ?? null,
    }));
}

export { AGENDA_BASICO_TUTORIAL, CLINIC_MODULE_TUTORIALS };
