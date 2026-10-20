export {
  TutorialProvider,
  useOptionalTutorial,
  useTutorial,
} from "@/features/tutoriales/components/tutorial-provider";
export { TutorialesCatalog } from "@/features/tutoriales/components/tutoriales-catalog";
export { buildStandardModuleTutorial } from "@/features/tutoriales/definitions/build-module-tutorial";
export {
  AGENDA_BASICO_TUTORIAL,
  buildAcademyCards,
  getTutorialById,
  listTutorials,
  listTutorialsForRole,
} from "@/features/tutoriales/registry";
export { TOUR_TARGETS, tourSelector } from "@/features/tutoriales/targets";
export type {
  AcademyModuleCard,
  TutorialAudienceRole,
  TutorialDefinition,
  TutorialProgress,
  TutorialStep,
} from "@/features/tutoriales/types";
