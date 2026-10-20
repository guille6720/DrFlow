import type { TutorialDefinition, TutorialStep } from "@/features/tutoriales/types";

export function pathsMatch(pathname: string, route: string): boolean {
  const a = pathname.replace(/\/+$/, "") || "/";
  const b = route.replace(/\/+$/, "") || "/";
  return a === b || a.startsWith(`${b}/`);
}

export type RouteDecision =
  | { kind: "ok" }
  | { kind: "navigate"; href: string }
  | { kind: "blocked-permission" };

export function resolveTutorialRoute(input: {
  tutorial: TutorialDefinition;
  step: TutorialStep;
  pathname: string;
  hasPermission: (permission: string) => boolean;
}): RouteDecision {
  const { step, pathname, hasPermission } = input;
  if (step.validation?.requirePermission && !hasPermission(step.validation.requirePermission)) {
    return { kind: "blocked-permission" };
  }
  const route = step.route;
  if (!route) return { kind: "ok" };
  if (pathsMatch(pathname, route)) return { kind: "ok" };
  return { kind: "navigate", href: route };
}
