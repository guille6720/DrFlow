import { type FeatureKey, FEATURES } from "@/core/entitlements/features";
import { PLAN_KEYS, type PlanKey } from "@/core/entitlements/plan-keys";
import {
  classifyUsageBand,
  DEFAULT_USAGE_THRESHOLDS,
  usagePercentage,
  type UsageThresholds,
} from "@/core/entitlements/usage-thresholds";

export type RecommendationSeverity = "info" | "warning" | "critical" | "manual_review";

export type PlanRecommendationInput = {
  currentPlanKey: string | null;
  status: string | null;
  /** Effective feature enablement (after overrides). */
  enabledFeatures: Partial<Record<FeatureKey, boolean>>;
  /** Features granted only by active override (not plan). */
  overrideGrantedFeatures?: Partial<Record<FeatureKey, boolean>>;
  usage: Partial<Record<FeatureKey, number>>;
  limits: Partial<Record<FeatureKey, number | null>>;
  counts?: {
    users?: number;
    professionals?: number;
    patients?: number;
  };
  thresholds?: UsageThresholds;
};

export type PlanRecommendationResult = {
  currentPlan: string | null;
  recommendedPlan: string | null;
  shouldRecommendUpgrade: boolean;
  severity: RecommendationSeverity;
  score: number;
  reasons: string[];
  signalFingerprint: string;
};

const PLAN_RANK: Record<string, number> = {
  [PLAN_KEYS.TRIAL]: 0,
  [PLAN_KEYS.BASIC]: 1,
  [PLAN_KEYS.PRO]: 2,
  [PLAN_KEYS.PREMIUM]: 3,
  [PLAN_KEYS.ENTERPRISE]: 4,
  [PLAN_KEYS.LEGACY]: -1,
};

const PRO_SIGNALS: FeatureKey[] = [
  FEATURES.PAMI,
  FEATURES.INSURANCE,
  FEATURES.DATA_EXPORT,
  FEATURES.PDF_EXPORT,
  FEATURES.ADVANCED_REPORTS,
  FEATURES.CASH_REGISTER,
  FEATURES.PHARMACOLOGY,
];

const PREMIUM_SIGNALS: FeatureKey[] = [
  FEATURES.AI,
  FEATURES.AI_CLINICAL_SUMMARY,
  FEATURES.AI_DOCUMENT_GENERATION,
  FEATURES.AI_TRANSCRIPTION,
  FEATURES.WHATSAPP,
  FEATURES.WHATSAPP_REMINDERS,
  FEATURES.AUTOMATION,
  FEATURES.AUTOMATION_FOLLOW_UP,
  FEATURES.VOICE,
];

function isEnabled(
  map: Partial<Record<FeatureKey, boolean>> | undefined,
  key: FeatureKey
): boolean {
  return map?.[key] === true;
}

function limitNear(
  usage: number | undefined,
  limit: number | null | undefined,
  thresholds: UsageThresholds,
  band: "warning" | "critical"
): boolean {
  if (usage === undefined) return false;
  const classified = classifyUsageBand(usage, limit, thresholds);
  if (band === "warning") {
    return classified === "warning" || classified === "critical" || classified === "exceeded";
  }
  return classified === "critical" || classified === "exceeded";
}

function fingerprint(parts: string[]): string {
  return parts.slice().sort().join("|");
}

/**
 * Pure recommendation engine — no DB I/O.
 * Call from server with effective entitlements + usage.
 */
export function getPlanRecommendation(input: PlanRecommendationInput): PlanRecommendationResult {
  const thresholds = input.thresholds ?? DEFAULT_USAGE_THRESHOLDS;
  const current = input.currentPlanKey;
  const reasons: string[] = [];
  let score = 0;
  let target: string | null = null;
  let severity: RecommendationSeverity = "info";

  if (!current) {
    return {
      currentPlan: null,
      recommendedPlan: null,
      shouldRecommendUpgrade: false,
      severity: "info",
      score: 0,
      reasons: ["Sin plan comercial asignado"],
      signalFingerprint: "no_plan",
    };
  }

  if (current === PLAN_KEYS.LEGACY) {
    return {
      currentPlan: current,
      recommendedPlan: null,
      shouldRecommendUpgrade: false,
      severity: "manual_review",
      score: 0,
      reasons: ["Legacy — revisión comercial manual requerida"],
      signalFingerprint: "legacy_manual",
    };
  }

  const override = input.overrideGrantedFeatures ?? {};
  const enabled = input.enabledFeatures;

  const proHits = PRO_SIGNALS.filter((k) => isEnabled(enabled, k));
  const premiumHits = PREMIUM_SIGNALS.filter((k) => isEnabled(enabled, k));
  // Premium signals that come only from override should not alone force Premium upgrade.
  const premiumFromPlan = premiumHits.filter((k) => !isEnabled(override, k));

  const seatSignals: string[] = [];
  for (const key of [FEATURES.PATIENTS_MAX, FEATURES.USERS_MAX, FEATURES.PROFESSIONALS_MAX] as const) {
    const usage = input.usage[key] ?? input.counts?.[
      key === FEATURES.PATIENTS_MAX ? "patients" : key === FEATURES.USERS_MAX ? "users" : "professionals"
    ];
    const limit = input.limits[key];
    if (usage === undefined) continue;
    const pct = usagePercentage(usage, limit);
    if (limitNear(usage, limit, thresholds, "critical")) {
      seatSignals.push(`${key} al límite (${pct ?? "?"}% )`);
      score += 25;
    } else if (limitNear(usage, limit, thresholds, "warning")) {
      seatSignals.push(`${key} cerca del límite (${pct ?? "?"}% )`);
      score += 15;
    }
  }

  for (const key of [
    FEATURES.AI_MONTHLY_REQUESTS,
    FEATURES.WHATSAPP_MONTHLY_MESSAGES,
    FEATURES.AI_MONTHLY_TRANSCRIPTIONS,
  ] as const) {
    const usage = input.usage[key];
    const limit = input.limits[key];
    if (usage === undefined) continue;
    if (limitNear(usage, limit, thresholds, "warning")) {
      const pct = usagePercentage(usage, limit);
      reasons.push(`Uso medido ${key}: ${pct}%`);
      score += 12;
      if (!premiumFromPlan.includes(FEATURES.AI) && key.startsWith("ai.")) {
        // metered AI usage implies AI product need
      }
    }
  }

  const counts = input.counts ?? {};
  const enterpriseSignals: string[] = [];
  if ((counts.users ?? 0) >= 25) enterpriseSignals.push("Alto número de usuarios");
  if ((counts.professionals ?? 0) >= 15) enterpriseSignals.push("Muchos profesionales");
  if ((counts.patients ?? 0) >= 10000) enterpriseSignals.push("Gran volumen de pacientes");
  if (isEnabled(enabled, FEATURES.API) && !isEnabled(override, FEATURES.API)) {
    enterpriseSignals.push("API pública en uso");
  }
  if (isEnabled(enabled, FEATURES.INTEGRATIONS) && !isEnabled(override, FEATURES.INTEGRATIONS)) {
    enterpriseSignals.push("Integraciones / FHIR");
  }

  if (enterpriseSignals.length >= 2) {
    target = PLAN_KEYS.ENTERPRISE;
    severity = "manual_review";
    score = Math.min(100, score + 40 + enterpriseSignals.length * 5);
    reasons.push(...enterpriseSignals, "Enterprise: revisión comercial recomendada");
  } else if (premiumFromPlan.length > 0 || (score >= 20 && premiumHits.length > 0 && premiumFromPlan.length > 0)) {
    target = PLAN_KEYS.PREMIUM;
    severity = "warning";
    score = Math.min(100, score + 30 + premiumFromPlan.length * 8);
    for (const k of premiumFromPlan) reasons.push(`Señal Premium: ${k}`);
  } else if (
    proHits.length > 0 ||
    seatSignals.length > 0 ||
    (current === PLAN_KEYS.BASIC && score >= 15)
  ) {
    target = PLAN_KEYS.PRO;
    severity = seatSignals.some((s) => s.includes("al límite")) ? "critical" : "warning";
    score = Math.min(100, score + 20 + proHits.length * 8);
    for (const k of proHits) reasons.push(`Señal Pro: ${k}`);
    reasons.push(...seatSignals);
  }

  // Trial: suggest best-fit paid plan without auto-convert.
  if (current === PLAN_KEYS.TRIAL) {
    if (!target) target = PLAN_KEYS.BASIC;
    if (premiumFromPlan.length > 0) target = PLAN_KEYS.PREMIUM;
    else if (proHits.length > 0 || seatSignals.length > 0) target = PLAN_KEYS.PRO;
    else target = PLAN_KEYS.BASIC;
    severity = "info";
    reasons.unshift("Trial — plan pago sugerido (sin conversión automática)");
    score = Math.max(score, 40);
  }

  // Never recommend same or lower tier (except trial → paid).
  if (target && current !== PLAN_KEYS.TRIAL) {
    const curRank = PLAN_RANK[current] ?? 0;
    const tgtRank = PLAN_RANK[target] ?? 0;
    if (tgtRank <= curRank) {
      target = null;
    }
  }

  // Pro + AI only via override → do not recommend Premium solely for AI.
  if (
    target === PLAN_KEYS.PREMIUM &&
    current === PLAN_KEYS.PRO &&
    premiumFromPlan.length === 0 &&
    premiumHits.every((k) => isEnabled(override, k))
  ) {
    target = null;
    reasons.push("AI/WhatsApp vía override — no sugiere Premium solo por eso");
    score = Math.min(score, 30);
  }

  if (current === PLAN_KEYS.BASIC && !target && proHits.length === 0 && seatSignals.length === 0) {
    return {
      currentPlan: current,
      recommendedPlan: null,
      shouldRecommendUpgrade: false,
      severity: "info",
      score: 0,
      reasons: ["Uso dentro de capacidades Basic"],
      signalFingerprint: fingerprint(["basic_ok"]),
    };
  }

  const should = Boolean(target) && target !== current;
  const fp = fingerprint([
    current,
    target ?? "none",
    ...reasons.map((r) => r.slice(0, 48)),
  ]);

  return {
    currentPlan: current,
    recommendedPlan: should ? target : null,
    shouldRecommendUpgrade: should,
    severity: should ? severity : "info",
    score: should ? Math.min(100, score) : 0,
    reasons: should ? reasons : reasons.length ? reasons : ["Sin upgrade recomendado"],
    signalFingerprint: fp,
  };
}

export function isPlanKey(value: string): value is PlanKey {
  return Object.values(PLAN_KEYS).includes(value as PlanKey);
}
