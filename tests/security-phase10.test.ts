import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { mergePatientClinicalFields } from "@/lib/server/patient-clinical-profile";
import { isSameOriginPost } from "@/lib/security/csrf";

describe("mergePatientClinicalFields", () => {
  it("merges profile fields onto patient row", () => {
    const merged = mergePatientClinicalFields(
      { id: "p1", first_name: "Ana" },
      { medical_history: "HTA", allergies: "Penicilina", regular_medication: null, notes: null }
    );
    expect(merged.allergies).toBe("Penicilina");
    expect(merged.first_name).toBe("Ana");
  });

  it("defaults clinical fields to null without profile", () => {
    const merged = mergePatientClinicalFields({ id: "p1" }, null);
    expect(merged.medical_history).toBeNull();
    expect(merged.notes).toBeNull();
  });
});

describe("isSameOriginPost", () => {
  it("accepts matching origin host", () => {
    const request = {
      headers: new Headers({
        host: "drflow.opusorg.com",
        origin: "https://drflow.opusorg.com",
      }),
    } as import("next/server").NextRequest;

    expect(isSameOriginPost(request)).toBe(true);
  });

  it("rejects foreign origin", () => {
    const request = {
      headers: new Headers({
        host: "drflow.opusorg.com",
        origin: "https://evil.example",
      }),
    } as import("next/server").NextRequest;

    expect(isSameOriginPost(request)).toBe(false);
  });

  it("falls back to referer when origin missing", () => {
    const request = {
      headers: new Headers({
        host: "localhost:3000",
        referer: "http://localhost:3000/login",
      }),
    } as import("next/server").NextRequest;

    expect(isSameOriginPost(request)).toBe(true);
  });
});

describe("047_security_phase10 migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/047_security_phase10.sql"),
    "utf8"
  );

  it("creates patient_clinical_profiles with can_view_clinical RLS", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS patient_clinical_profiles/);
    expect(sql).toMatch(/patient_clinical_profiles_select/);
    expect(sql).toMatch(/can_view_clinical\(clinic_id\)/);
  });

  it("clears PHI columns on patients after migration", () => {
    expect(sql).toMatch(/UPDATE patients[\s\S]*medical_history = NULL/);
  });

  it("enforces trial on clinical writes", () => {
    expect(sql).toMatch(/clinic_subscription_active/);
    expect(sql).toMatch(/can_write_clinical/);
    expect(sql).toMatch(/clinical_records_insert/);
  });

  it("excludes secretary from can_view_clinical", () => {
    expect(sql).toMatch(/can_view_clinical[\s\S]*clinic_admin', 'doctor/);
  });
});
