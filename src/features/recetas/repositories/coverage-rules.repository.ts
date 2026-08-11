import type { DbClient, RepoResult } from "@/core/repositories/types";
import { mapPostgresError, repoErr, repoOk } from "@/core/repositories/types";

import type { CoverageRuleConfig } from "@/features/recetas/engine/types";
import type { CoverageKind } from "@/features/recetas/engine/types";

export type CoverageRuleRow = {
  id?: string;
  coverage_kind: CoverageKind;
  rules: Partial<CoverageRuleConfig>;
  active?: boolean;
};

const RULE_COLUMNS = "id, coverage_kind, rules, active";

export async function loadActiveCoverageRulesForClinic(
  db: DbClient,
  clinicId: string
): Promise<RepoResult<CoverageRuleRow[]>> {
  const { data, error } = await db
    .from("coverage_rules")
    .select(RULE_COLUMNS)
    .eq("clinic_id", clinicId)
    .eq("active", true);

  if (error) return repoErr(mapPostgresError(error));
  return repoOk((data ?? []) as CoverageRuleRow[]);
}

export async function loadCoverageRuleForKind(
  db: DbClient,
  clinicId: string,
  coverageKind: CoverageKind
): Promise<RepoResult<CoverageRuleRow | null>> {
  const { data, error } = await db
    .from("coverage_rules")
    .select(RULE_COLUMNS)
    .eq("clinic_id", clinicId)
    .eq("coverage_kind", coverageKind)
    .maybeSingle();

  if (error) return repoErr(mapPostgresError(error));
  return repoOk((data as CoverageRuleRow | null) ?? null);
}

export async function upsertCoverageRule(
  db: DbClient,
  clinicId: string,
  coverageKind: CoverageKind,
  rules: Partial<CoverageRuleConfig>,
  active = true
): Promise<RepoResult<CoverageRuleRow>> {
  const { data, error } = await db
    .from("coverage_rules")
    .upsert(
      {
        clinic_id: clinicId,
        coverage_kind: coverageKind,
        rules,
        active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clinic_id,coverage_kind" }
    )
    .select(RULE_COLUMNS)
    .single();

  if (error) return repoErr(mapPostgresError(error));
  return repoOk(data as CoverageRuleRow);
}

export async function deleteCoverageRuleForKind(
  db: DbClient,
  clinicId: string,
  coverageKind: CoverageKind
): Promise<RepoResult<{ coverage_kind: CoverageKind }>> {
  const { error } = await db
    .from("coverage_rules")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("coverage_kind", coverageKind)
    .select("coverage_kind")
    .maybeSingle();

  if (error) return repoErr(mapPostgresError(error));
  return repoOk({ coverage_kind: coverageKind });
}
