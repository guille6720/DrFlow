import { describe, expect, it } from "vitest";

import {
  A11Y_THEME_FORBIDDEN_PREFIXES,
  A11Y_THEME_PRESENTATION_ALLOWLIST,
  classifyA11yThemePath,
  isForbiddenA11yThemePath,
} from "@/core/theme/a11y-scope";

describe("A11y theme scope policy (section 14)", () => {
  it("forbids data / auth / API / clinical action surfaces", () => {
    for (const sample of [
      "supabase/migrations/129_superadmin_commercial_control.sql",
      "src/core/auth/session.server.ts",
      "src/core/permissions/roles.ts",
      "src/core/entitlements/features.ts",
      "src/app/api/clinical-ai/route.ts",
      "src/lib/actions/appointments.ts",
      "src/core/jobs/process.ts",
      "src/types/database.ts",
    ]) {
      expect(classifyA11yThemePath(sample), sample).toBe("forbidden");
      expect(isForbiddenA11yThemePath(sample), sample).toBe(true);
    }
  });

  it("allows theme CSS, tokens, e2e a11y, and UI primitives", () => {
    for (const sample of [
      "src/core/theme/modal-states.css",
      "src/core/theme/semantic-tokens.css",
      "src/app/globals.css",
      "src/components/ui/button.tsx",
      "e2e/a11y-theme-audit.spec.ts",
      "e2e/helpers/a11y.ts",
      "tests/theme-contrast.test.ts",
      "playwright.config.ts",
      "package.json",
    ]) {
      expect(classifyA11yThemePath(sample), sample).toBe("allowed");
    }
  });

  it("allows presentation-only className files on the allowlist", () => {
    for (const sample of A11Y_THEME_PRESENTATION_ALLOWLIST) {
      expect(classifyA11yThemePath(sample), sample).toBe("presentation");
      expect(isForbiddenA11yThemePath(sample), sample).toBe(false);
    }
  });

  it("blocks other feature modules as out of scope", () => {
    expect(classifyA11yThemePath("src/features/pacientes/actions/patients.ts")).toBe("forbidden");
    expect(classifyA11yThemePath("src/features/turnos/actions/reschedule-appointment.ts")).toBe(
      "forbidden"
    );
  });

  it("documents the non-goals", () => {
    const joined = A11Y_THEME_FORBIDDEN_PREFIXES.join(" ");
    expect(joined).toContain("supabase/migrations");
    expect(joined).toContain("src/core/auth");
    expect(joined).toContain("src/core/permissions");
    expect(joined).toContain("src/core/entitlements");
    expect(joined).toContain("src/app/api");
    expect(joined).toContain("src/lib/actions");
  });
});
