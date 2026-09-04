/**
 * Scope policy for NexClinic theme / accessibility work (brief §14).
 * Visual/theme/a11y only — never behavior, data, or auth.
 */

/** Path prefixes that theme/a11y changes may touch. */
export const A11Y_THEME_ALLOWED_PREFIXES = [
  "src/core/theme/",
  "src/app/globals.css",
  "src/core/app-release.ts",
  "src/components/ui/",
  "src/core/components/theme/",
  "src/core/components/layout/guest-appearance-modal.tsx",
  "src/core/components/layout/user-account-modal.tsx",
  "src/core/components/layout/user-account-modal-content.tsx",
  "src/core/qa/checklist-data.ts",
  "src/features/configuracion/components/configuracion/appearance-style-panel.tsx",
  "e2e/a11y-",
  "e2e/helpers/a11y.ts",
  "e2e/helpers/theme.ts",
  "e2e/helpers/auth.ts",
  "playwright.config.ts",
  "tests/",
  "package.json",
  "package-lock.json",
  "scripts/audit-problematic-css",
  "scripts/check-a11y-theme-scope",
] as const;

/**
 * Path prefixes that must NEVER appear in a theme/a11y-only commit.
 * (ClassName-only UI tweaks on feature components are allowed via explicit review;
 *  these blocks catch structural / server / data changes.)
 */
export const A11Y_THEME_FORBIDDEN_PREFIXES = [
  "supabase/migrations/",
  "supabase/seeds/",
  "supabase/functions/",
  "src/core/auth/",
  "src/core/permissions/",
  "src/core/entitlements/",
  "src/core/supabase/",
  "src/app/api/",
  "src/lib/actions/",
  "src/features/",
  "src/core/jobs/",
  "src/core/notifications/",
  "src/core/public-api/",
  "src/types/database",
] as const;

/** Feature UI files where only className / presentation markers are OK for a11y. */
export const A11Y_THEME_PRESENTATION_ALLOWLIST = [
  "src/app/(dashboard)/superadmin/layout.tsx",
  "src/features/pacientes/components/pacientes/workspace/patient-workspace-overlay.tsx",
  "src/features/historias/components/consultas/drapp-consulta-full-modal.tsx",
  "src/features/historias/components/historias/diagnosis-related-actions-panel.tsx",
  "src/features/agenda/components/agenda/cancel-appointment-dialog.tsx",
  "src/features/agenda/components/agenda/calendar-appointment-dialog.tsx",
  "src/features/agenda/components/agenda/edit-appointment-dialog.tsx",
  "src/features/agenda/components/agenda/reschedule-appointment-dialog.tsx",
  "src/features/recetas/components/recetas/whatsapp-share-confirm-dialog.tsx",
  "src/features/configuracion/components/configuracion/delete-account-panel.tsx",
] as const;

export function isForbiddenA11yThemePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  if (A11Y_THEME_PRESENTATION_ALLOWLIST.some((p) => normalized === p || normalized.endsWith(p))) {
    return false;
  }
  if (
    A11Y_THEME_ALLOWED_PREFIXES.some(
      (p) => normalized === p || normalized.startsWith(p) || normalized.includes(`/${p}`)
    )
  ) {
    // Exact/prefix allow — but features/ is also in forbidden; presentation allowlist already returned
    if (normalized.startsWith("src/features/") || normalized.includes("/src/features/")) {
      return !A11Y_THEME_PRESENTATION_ALLOWLIST.some(
        (p) => normalized === p || normalized.endsWith(p)
      );
    }
    return false;
  }
  return A11Y_THEME_FORBIDDEN_PREFIXES.some((p) => normalized.startsWith(p));
}

export function classifyA11yThemePath(
  filePath: string
): "allowed" | "presentation" | "forbidden" | "unrelated" {
  const normalized = filePath.replace(/\\/g, "/");
  if (A11Y_THEME_PRESENTATION_ALLOWLIST.some((p) => normalized === p || normalized.endsWith(p))) {
    return "presentation";
  }
  if (
    A11Y_THEME_ALLOWED_PREFIXES.some(
      (p) => normalized === p || normalized.startsWith(p)
    )
  ) {
    return "allowed";
  }
  if (A11Y_THEME_FORBIDDEN_PREFIXES.some((p) => normalized.startsWith(p))) {
    return "forbidden";
  }
  return "unrelated";
}
