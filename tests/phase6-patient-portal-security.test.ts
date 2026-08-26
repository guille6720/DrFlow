import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  buildPortalCookieOptions,
  getPortalAuthErrorMessage,
  getPortalSessionRequiredMessage,
  PATIENT_PORTAL_COOKIE,
} from "@/core/portal/patient-portal-cookie";
import {
  publicBookingCancelSchema,
  publicBookingPortalAppointmentsSchema,
  publicBookingSchema,
  publicBookingStatusesSchema,
} from "@/core/validations/public-booking";

function loadMigration(name: string): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
}

function loadAllMigrations(): string {
  const dir = resolve(process.cwd(), "supabase/migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(resolve(dir, f), "utf8"))
    .join("\n");
}

const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);

describe("Phase 6 — patient portal security (static + unit)", () => {
  const sql = loadAllMigrations();
  const accessRoute = readFileSync(
    resolve(process.cwd(), "src/app/portal/[slug]/access/route.ts"),
    "utf8"
  );
  const cookieModule = readFileSync(
    resolve(process.cwd(), "src/core/portal/patient-portal-cookie.ts"),
    "utf8"
  );
  const publicBookingActions = readFileSync(
    resolve(process.cwd(), "src/lib/actions/public-booking.ts"),
    "utf8"
  );
  const requestsPanel = readFileSync(
    resolve(process.cwd(), "src/features/portal/components/portal/patient-requests-panel.tsx"),
    "utf8"
  );
  const requestsHook = readFileSync(
    resolve(process.cwd(), "src/features/pacientes/hooks/use-patient-requests-panel.ts"),
    "utf8"
  );
  const logoutAction = readFileSync(
    resolve(process.cwd(), "src/features/portal/actions/patient-portal-logout.ts"),
    "utf8"
  );

  it("1. valid secure portal link path validates token+slug then sets cookie and redirects without token", () => {
    expect(accessRoute).toContain("validate_patient_portal_session_v2");
    expect(accessRoute).toContain("buildPortalCookieOptions");
    expect(accessRoute).toContain("PATIENT_PORTAL_COOKIE");
    expect(accessRoute).toMatch(/redirect\(destination/);
    expect(accessRoute).not.toMatch(/destination\.searchParams\.set\(["']token/);
  });

  it("2. invalid token redirects to generic portal_error", () => {
    expect(accessRoute).toContain('portal_error", "1"');
    expect(getPortalAuthErrorMessage()).toBe("El enlace de acceso no es válido o venció.");
  });

  it("3–4. expired/revoked sessions fail validation via _resolve_patient_portal_session", () => {
    const sessions = loadMigration("20260826123241_patient_portal_token_sessions.sql");
    expect(sessions).toMatch(/expires_at\s*<\s*pg_catalog\.now\(\)|expires_at.*now\(\)/i);
    expect(sessions).toMatch(/revoked_at\s+IS\s+NOT\s+NULL|revoked_at/i);
    expect(sessions).toContain("_resolve_patient_portal_session");
  });

  it("5. token Clinic A → Clinic B denied (slug binding)", () => {
    const validate = loadMigration("20260826123700_patient_portal_slug_session_validation.sql");
    expect(validate).toContain("validate_patient_portal_session_v2");
    expect(validate).toMatch(/c\.slug\s*=\s*v_slug/);
    expect(validate).toMatch(/pbl\.slug\s*=\s*v_slug/);
    expect(validate).toMatch(/RETURN QUERY SELECT false/);
  });

  it("6. Patient A → Patient B denied (session scopes patient_id)", () => {
    const v2 = loadMigration("20260826123459_patient_portal_professional_join_fix.sql");
    expect(v2).toMatch(/a\.patient_id\s*=\s*v_session\.patient_id/);
    expect(v2).toMatch(/a\.clinic_id\s*=\s*v_session\.clinic_id/);
  });

  it("7. appointment list uses get_patient_portal_appointments_v2(token)", () => {
    expect(publicBookingActions).toContain("get_patient_portal_appointments_v2");
    expect(publicBookingActions).toContain("readPatientPortalToken");
    expect(publicBookingActions).not.toContain('rpc("get_patient_portal_appointments"');
    expect(publicBookingPortalAppointmentsSchema.safeParse({ slug: "demo" }).success).toBe(true);
    expect(
      publicBookingPortalAppointmentsSchema.safeParse({
        slug: "demo",
        document_number: "12345678",
      }).success
    ).toBe(true);
    const parsed = publicBookingPortalAppointmentsSchema.parse({
      slug: "demo",
      document_number: "12345678",
    });
    expect("document_number" in parsed).toBe(false);
  });

  it("8–9. cancel uses cancel_patient_appointment_v2 and scopes by session patient", () => {
    expect(publicBookingActions).toContain("cancel_patient_appointment_v2");
    const v2 = loadMigration("20260826123459_patient_portal_professional_join_fix.sql");
    expect(v2).toContain("cancel_patient_appointment_v2");
    expect(v2).toMatch(/a\.patient_id\s*=\s*v_session\.patient_id/);
    expect(v2).toMatch(/APPOINTMENT_NOT_FOUND/);
  });

  it("10. consent v2 writes against session clinic + patient", () => {
    const v2 = loadMigration("20260826123459_patient_portal_professional_join_fix.sql");
    expect(v2).toContain("record_patient_data_consent_v2");
    expect(v2).toMatch(/v_session\.clinic_id/);
    expect(v2).toMatch(/v_session\.patient_id/);
    expect(v2).toMatch(/source.*patient_portal_token|'patient_portal_token'/);
  });

  it("11. legacy DNI-only portal RPCs revoked for anon", () => {
    const validate = loadMigration("20260826123700_patient_portal_slug_session_validation.sql");
    expect(validate).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.get_patient_portal_appointments\(text, text\) FROM anon/i
    );
    expect(validate).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.get_patient_appointment_statuses\(text, text, uuid\[\]\) FROM anon/i
    );
    expect(validate).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.cancel_patient_appointment\(text, text, uuid, text\) FROM anon/i
    );
    expect(requestsPanel).not.toMatch(/Ingresá tu DNI/);
    expect(requestsHook).not.toMatch(/documentNumber|document_number/);
  });

  it("12. public booking remains anonymous (no portal token required)", () => {
    expect(publicBookingActions).toContain("submit_public_booking");
    expect(publicBookingActions).toContain("get_public_booking_occupancy");
    const submitStart = publicBookingActions.indexOf("export async function submitPublicBooking");
    const submitEnd = publicBookingActions.indexOf(
      "export async function fetchPatientAppointmentStatuses"
    );
    const submitBody = publicBookingActions.slice(submitStart, submitEnd);
    expect(submitBody).not.toContain("readPatientPortalToken");
    expect(submitBody).not.toContain("requireValidPortalToken");
    expect(
      publicBookingSchema.safeParse({
        slug: "demo",
        professional_id: "550e8400-e29b-41d4-a716-446655440000",
        start_at: "2026-09-01T15:00:00.000Z",
        first_name: "Ana",
        last_name: "Test",
        document_number: "30123456",
        phone: "1112345678",
        email: "",
        privacy_consent: "true",
      }).success
    ).toBe(true);
  });

  it("13. existing patient public booking does not overwrite demographics", () => {
    const m143 = loadMigration("20260826140000_public_booking_preserve_patient_demographics.sql");
    expect(m143).toContain("submit_public_booking");
    expect(m143).toMatch(/do NOT overwrite/i);
    expect(m143).not.toMatch(
      /UPDATE patients SET[\s\S]*first_name\s*=\s*trim\(p_first_name\)/
    );
  });

  it("14. raw token disappears from URL after access (redirect to /portal/slug without token)", () => {
    expect(accessRoute).toContain("`/portal/${encodeURIComponent(slug)}`");
    expect(accessRoute).not.toContain("token=${");
  });

  it("15. raw token is not stored in localStorage/sessionStorage", () => {
    expect(cookieModule).not.toMatch(/localStorage|sessionStorage/);
    expect(accessRoute).not.toMatch(/localStorage|sessionStorage/);
    expect(requestsHook).not.toMatch(/localStorage|sessionStorage/);
    expect(publicBookingActions).not.toMatch(/localStorage|sessionStorage/);
  });

  it("16. portal cookie is HttpOnly with path=/portal and SameSite=Lax", () => {
    expect(PATIENT_PORTAL_COOKIE).toBe("drflow_patient_portal");
    const opts = buildPortalCookieOptions(new Date(Date.now() + 30 * 60_000));
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/portal");
    expect(cookieModule).toContain("httpOnly: true");
  });

  it("17. logout clears portal cookie", () => {
    expect(logoutAction).toContain("clearPatientPortalCookie");
    expect(requestsPanel).toContain("Cerrar sesión");
    expect(getPortalSessionRequiredMessage()).toMatch(/enlace seguro/i);
  });

  it("staff create session scopes and migration files reconciled", () => {
    expect(sql).toContain("create_patient_portal_session");
    expect(sql).toContain("patient_portal_sessions");
    const staff = readFileSync(
      resolve(process.cwd(), "src/features/portal/actions/create-patient-portal-access.ts"),
      "utf8"
    );
    expect(staff).toContain("create_patient_portal_session");
    expect(staff).toContain("appointments:read");
    expect(staff).toContain("/access?token=");
    expect(staff).not.toMatch(/console\.(log|info|debug).*token/i);
  });

  it("statuses schema no longer requires DNI", () => {
    expect(
      publicBookingStatusesSchema.safeParse({
        slug: "demo",
        appointment_ids: ["550e8400-e29b-41d4-a716-446655440000"],
      }).success
    ).toBe(true);
    expect(
      publicBookingCancelSchema.safeParse({
        slug: "demo",
        appointment_id: "550e8400-e29b-41d4-a716-446655440000",
        reason: "No puedo asistir",
      }).success
    ).toBe(true);
  });

  it("tokens used in fixtures are opaque hex shapes", () => {
    expect(TOKEN_A).toHaveLength(64);
    expect(TOKEN_B).toHaveLength(64);
    expect(TOKEN_A).not.toBe(TOKEN_B);
  });
});
