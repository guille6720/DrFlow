import { type AppEnvironment, getRuntimeEnvironment } from "@/core/environment/runtime";

const BADGE_LABELS: Partial<Record<AppEnvironment | "unknown", string>> = {
  staging: "STAGING",
  fiscalization: "FISCALIZACIÓN",
};

/** Label for the non-production banner; null means "render nothing" (always the case in production). */
export function environmentBadgeLabel(environment: AppEnvironment | "unknown"): string | null {
  return BADGE_LABELS[environment] ?? null;
}

/** Server-rendered, so no refs or env details ever reach the browser — only the label. */
export function EnvironmentBadge({ environment = getRuntimeEnvironment() }: { environment?: AppEnvironment | "unknown" }) {
  const label = environmentBadgeLabel(environment);
  if (!label) return null;
  return (
    <div
      role="status"
      aria-label={`Entorno ${label}: no es producción`}
      data-testid="environment-badge"
      data-environment={environment}
      className="pointer-events-none fixed bottom-2 left-2 z-[9999] rounded-md border border-amber-600 bg-amber-400 px-2 py-0.5 text-[11px] font-bold tracking-wider text-slate-950 shadow-md print:hidden"
    >
      {label}
    </div>
  );
}
