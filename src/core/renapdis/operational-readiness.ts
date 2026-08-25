/**
 * ReNaPDiS Phase 3 — operational readiness status model (staging).
 * Never auto-claims homologation.
 */

export const READINESS_STATES = [
  "ready",
  "partial",
  "blocked_external",
  "not_configured",
] as const;

export type ReadinessState = (typeof READINESS_STATES)[number];

export type ReadinessItem = {
  id: string;
  label: string;
  state: ReadinessState;
  evidence: string;
  actionNeeded: string | null;
};

export type OpsAlertSeverity = "critical" | "warning";

export type OpsAlertThreshold = {
  id: string;
  severity: OpsAlertSeverity;
  description: string;
  /** Env var for notification target — never hardcode personal contacts. */
  notifyEnvVar: string;
};

export const OPS_ALERT_THRESHOLDS: OpsAlertThreshold[] = [
  {
    id: "app_unavailable",
    severity: "critical",
    description: "Application health/ready returns 503 or timeout",
    notifyEnvVar: "OPS_ALERT_WEBHOOK_URL",
  },
  {
    id: "db_unreachable",
    severity: "critical",
    description: "Supabase probe fails",
    notifyEnvVar: "OPS_ALERT_WEBHOOK_URL",
  },
  {
    id: "prescription_submit_unavailable",
    severity: "critical",
    description: "Repeated national prescription submission infrastructure failures",
    notifyEnvVar: "OPS_ALERT_WEBHOOK_URL",
  },
  {
    id: "auth_infra_failures",
    severity: "critical",
    description: "Repeated authentication infrastructure failures",
    notifyEnvVar: "OPS_ALERT_WEBHOOK_URL",
  },
  {
    id: "elevated_latency",
    severity: "warning",
    description: "Elevated API/query latency vs observability thresholds",
    notifyEnvVar: "OPS_ALERT_WEBHOOK_URL",
  },
  {
    id: "elevated_5xx",
    severity: "warning",
    description: "Elevated 5xx rate",
    notifyEnvVar: "OPS_ALERT_WEBHOOK_URL",
  },
  {
    id: "backup_verification_failed",
    severity: "warning",
    description: "Backup verification / restore drill failed",
    notifyEnvVar: "OPS_ALERT_WEBHOOK_URL",
  },
];

/** Static evidence-based readiness snapshot for staging docs/UI. */
export function getRenapdisOperationalReadiness(): ReadinessItem[] {
  const fiscalizationHostname =
    process.env.FISCALIZATION_PUBLIC_URL?.trim() ||
    "https://fiscalizacion.drflow.opusorg.com (DNS pending manual setup)";

  return [
    {
      id: "fiscalization_env",
      state: process.env.FISCALIZATION_PUBLIC_URL?.trim() ? "partial" : "not_configured",
      label: "Fiscalization environment",
      evidence: `Target host ${fiscalizationHostname}; same commit as staging candidate; synthetic clinic marker migration 142.`,
      actionNeeded:
        "Configure Vercel preview/alias + DNS CNAME for fiscalizacion.drflow.opusorg.com without touching production DNS unless credentials confirm isolation.",
    },
    {
      id: "health_endpoint",
      state: "ready",
      label: "Health endpoint",
      evidence: "/api/health, /api/health/live, /api/health/ready implemented; no secrets in public payload.",
      actionNeeded: null,
    },
    {
      id: "mfa",
      state: "ready",
      label: "MFA / AAL2 prescription gate",
      evidence: "Phase 1 MFA gates remain required for issue/submit.",
      actionNeeded: null,
    },
    {
      id: "refeps_adapter",
      state: "partial",
      label: "REFEPS adapter",
      evidence: "Sandbox adapter + optional API mode; forced outage mode via REFEPS_FORCE_OUTAGE.",
      actionNeeded: "Official Ministry credentials remain external.",
    },
    {
      id: "cuir",
      state: "partial",
      label: "CUIR",
      evidence: "Phase 2 official numeric Anexo IV model; sandbox clearly non-legal.",
      actionNeeded: "DNSISA platform/repository IDs + M4 mapping still external.",
    },
    {
      id: "backup_pitr",
      state: "blocked_external",
      label: "Backup / PITR",
      evidence:
        "Documented target RPO < 30 min. Current managed daily backup RPO ~24 h unless PITR enabled on Supabase plan.",
      actionNeeded: "Confirm staging/prod Supabase plan PITR; enable continuous backup if available.",
    },
    {
      id: "rpo_target",
      state: "blocked_external",
      label: "RPO target < 30 min",
      evidence: "Target configured in docs; not met by daily backups alone.",
      actionNeeded: "Enable PITR or equivalent continuous backup; then run restore drill.",
    },
    {
      id: "rto_drill",
      state: "not_configured",
      label: "RTO drill < 2 h",
      evidence: "Runbook + drill checklist prepared; no timed drill evidence yet.",
      actionNeeded: "Execute documented DR drill and record measured RTO.",
    },
    {
      id: "availability_monitoring",
      state: "partial",
      label: "Availability monitoring (99.8% SLO)",
      evidence: "GitHub Actions uptime workflow + health probes; SLI/SLO documented.",
      actionNeeded: "Accumulate monthly measurements; optional staging probe via STAGING_URL.",
    },
    {
      id: "dr_plan",
      state: "partial",
      label: "DR / continuity plan",
      evidence: "docs/DISASTER_RECOVERY.md updated for ReNaPDiS targets; scenario runbooks present.",
      actionNeeded: "Complete restore drill evidence twice per year.",
    },
    {
      id: "dnsisa_external",
      state: "blocked_external",
      label: "External DNSISA / Ministry dependencies",
      evidence: "No official platform/repository IDs or Ministry API homologation in DrFlow.",
      actionNeeded: "Await DNSISA assignment and official credentials.",
    },
  ];
}

export function isReadinessState(value: unknown): value is ReadinessState {
  return typeof value === "string" && (READINESS_STATES as readonly string[]).includes(value);
}
