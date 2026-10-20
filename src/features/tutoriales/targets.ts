/** Canonical data-tour values for NexClinic tutorials. */
export const TOUR_TARGETS = {
  AGENDA_ROOT: "agenda-root",
  AGENDA_HEADER: "agenda-header",
  AGENDA_VIEW_TOGGLE: "agenda-view-toggle",
  AGENDA_WEEK_NAV: "agenda-week-nav",
  AGENDA_WEEK_NAV_TODAY: "agenda-week-nav-today",
  AGENDA_FILTER_PROFESSIONAL: "agenda-filter-professional",
  AGENDA_FILTER_SPECIALTY: "agenda-filter-specialty",
  AGENDA_DAY_LIST: "agenda-day-list",
  AGENDA_NEW_BUTTON: "agenda-new-button",
  TUTORIALES_ROOT: "tutoriales-root",
} as const;

export type TourTargetId = (typeof TOUR_TARGETS)[keyof typeof TOUR_TARGETS];

export function moduleTourTargets(moduleId: string) {
  return {
    root: `${moduleId}-root`,
    header: `${moduleId}-header`,
    content: `${moduleId}-content`,
  } as const;
}

export function moduleActionTarget(moduleId: string, actionId: string): string {
  return `${moduleId}-${actionId}`;
}

export function tourSelector(target: string): string {
  return `[data-tour="${target}"]`;
}
