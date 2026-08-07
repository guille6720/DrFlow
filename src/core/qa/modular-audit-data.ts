import {
  flattenModuleEntryPoints,
  modularAuditStatsFromModules,
  QA_FUNCTIONAL_MODULES,
  type QaFunctionalModule,
} from "@/core/qa/modular-audit-layers";

export type ModularAuditModule = {
  id: string;
  layer: string;
  status: "ready" | "lab" | "planned";
  summary: string;
  inputs: string;
  outputs: string;
  entryPoints: string[];
  checks: { id: string; label: string; href?: string }[];
};

/** @deprecated Usar QA_FUNCTIONAL_MODULES para auditoría por capas */
export const MODULAR_QA_AUDIT: ModularAuditModule[] = QA_FUNCTIONAL_MODULES.map((mod) => ({
  id: mod.id,
  layer: mod.layers.map((l) => l.layerLabel).join(" · "),
  status: mod.status,
  summary: mod.layers.map((l) => l.what).join(" "),
  inputs: mod.layers.map((l) => l.inputs).join(" | "),
  outputs: mod.layers.map((l) => l.outputs).join(" | "),
  entryPoints: flattenModuleEntryPoints(mod),
  checks: mod.checks,
}));

export type { QaFunctionalModule };

export { modularAuditStatsFromModules, QA_FUNCTIONAL_MODULES };

export function modularAuditStats(checked: Record<string, boolean>) {
  return modularAuditStatsFromModules(QA_FUNCTIONAL_MODULES, checked);
}
