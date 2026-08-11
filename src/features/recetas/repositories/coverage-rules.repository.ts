import type { DbClient, RepoResult } from "@/core/repositories/types";
import { mapPostgresError, repoErr, repoOk } from "@/core/repositories/types";

import type { CoverageRuleConfig } from "@/features/recetas/engine/types";
import type { CoverageKind } from "@/features/recetas/engine/types";

export type CoverageRuleRow = {
  coverage_kind: CoverageKind;
  rules: Partial<CoverageRuleConfig>;
};

export async function loadActiveCoverageRulesForClinic(
  db: DbClient,
  clinicId: string
): Promise<RepoResult<CoverageRuleRow[]>> {
  const { data, error } = await db
    .from("coverage_rules")
    .select("coverage_kind, rules")
    .eq("clinic_id", clinicId)
    .eq("active", true);

  if (error) return repoErr(mapPostgresError(error));
  return repoOk((data ?? []) as CoverageRuleRow[]);
}
