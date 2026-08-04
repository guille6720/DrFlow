/** Enterprise stabilization line limits (Risk 1 + Risk 2). */
export const STABILIZATION_COMPONENT_MAX_LINES = 200;
export const STABILIZATION_HOOK_MAX_LINES = 150;
export const STABILIZATION_FUNCTION_MAX_LINES = 40;

export type StabilizationArtifactKind = "component" | "hook";

export function stabilizationLimit(kind: StabilizationArtifactKind): number {
  return kind === "component" ? STABILIZATION_COMPONENT_MAX_LINES : STABILIZATION_HOOK_MAX_LINES;
}

export function isWithinStabilizationLimit(
  lines: number,
  kind: StabilizationArtifactKind
): boolean {
  return lines <= stabilizationLimit(kind);
}
