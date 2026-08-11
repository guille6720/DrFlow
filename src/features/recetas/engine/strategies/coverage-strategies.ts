import { DEFAULT_COVERAGE_RULES } from "@/features/recetas/engine/default-coverage-rules";
import { BaseCoverageStrategy } from "@/features/recetas/engine/strategies/base.strategy";
import type {
  CoverageKind,
  CoverageRuleConfig,
  PrescriptionContext,
  PrescriptionEngineRow,
  ValidationIssue,
} from "@/features/recetas/engine/types";

import { isPamiCoverage } from "@/lib/constants/coverages";

const PREPAID_KEYWORDS = [
  "osde",
  "swiss medical",
  "galeno",
  "medifé",
  "medife",
  "omint",
  "medicus",
  "sancor",
  "hospital italiano",
  "accord salud",
] as const;

function isPrepaidCoverage(insurance: string | null | undefined): boolean {
  const normalized = (insurance ?? "").trim().toLowerCase();
  return PREPAID_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export class ParticularStrategy extends BaseCoverageStrategy {
  readonly kind: CoverageKind = "PARTICULAR";

  matches(insurance: string | null | undefined): boolean {
    const value = (insurance ?? "").trim().toLowerCase();
    return !value || value === "particular";
  }

  getDefaultRules(): CoverageRuleConfig {
    return DEFAULT_COVERAGE_RULES.PARTICULAR;
  }
}

export class PamiStrategy extends BaseCoverageStrategy {
  readonly kind: CoverageKind = "PAMI";

  matches(insurance: string | null | undefined): boolean {
    return isPamiCoverage(insurance);
  }

  getDefaultRules(): CoverageRuleConfig {
    return DEFAULT_COVERAGE_RULES.PAMI;
  }

  getWarnings(ctx: PrescriptionContext, draft: PrescriptionEngineRow): ValidationIssue[] {
    void draft;
    const warnings = super.getWarnings(ctx, draft);
    for (const message of ctx.rules.infoMessages ?? []) {
      warnings.push({
        severity: "warning",
        code: "pami_info",
        message,
      });
    }
    return warnings;
  }
}

export class PrepaidStrategy extends BaseCoverageStrategy {
  readonly kind: CoverageKind = "PREPAGAS";

  matches(insurance: string | null | undefined): boolean {
    return isPrepaidCoverage(insurance);
  }

  getDefaultRules(): CoverageRuleConfig {
    return DEFAULT_COVERAGE_RULES.PREPAGAS;
  }
}

export class InsuranceStrategy extends BaseCoverageStrategy {
  readonly kind: CoverageKind = "OBRAS_SOCIALES";

  matches(insurance: string | null | undefined): boolean {
    const value = (insurance ?? "").trim();
    if (!value) return false;
    return (
      !new ParticularStrategy().matches(value) &&
      !new PamiStrategy().matches(value) &&
      !isPrepaidCoverage(value)
    );
  }

  getDefaultRules(): CoverageRuleConfig {
    return DEFAULT_COVERAGE_RULES.OBRAS_SOCIALES;
  }
}

export const COVERAGE_STRATEGIES = [
  new PamiStrategy(),
  new PrepaidStrategy(),
  new ParticularStrategy(),
  new InsuranceStrategy(),
] as const;

export function getCoverageStrategy(kind: CoverageKind) {
  const strategy = COVERAGE_STRATEGIES.find((entry) => entry.kind === kind);
  if (!strategy) return new InsuranceStrategy();
  return strategy;
}

export function getCoverageStrategyForInsurance(insurance: string | null | undefined) {
  for (const strategy of COVERAGE_STRATEGIES) {
    if (strategy.matches(insurance)) return strategy;
  }
  return new InsuranceStrategy();
}
