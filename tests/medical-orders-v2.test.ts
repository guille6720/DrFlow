import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PERMISSION_GROUPS } from "@/core/permissions/role-permissions";
import { canAccessRoute, hasPermission, MANAGEABLE_PERMISSION_KEYS } from "@/core/permissions/roles";
import { isPublicLightPath } from "@/core/theme/ui-theme";

import {
  MEDICAL_ORDER_CATEGORIES,
  MEDICAL_ORDER_CATEGORY_LABELS,
  MEDICAL_ORDER_SIGNATURE_DISCLAIMER,
} from "@/features/ordenes-medicas/constants";
import {
  buildItemMetadata,
  buildMedicalOrderVerifyUrl,
  composeMedicalOrderText,
  computeAge,
  isMissingSchemaError,
  isValidVerificationToken,
  mapMedicalOrderDbError,
} from "@/features/ordenes-medicas/utils/medical-order-format";
import { cancelMedicalOrderSchema, medicalOrderInputSchema } from "@/features/ordenes-medicas/validation";

import { buildClinicalTimeline } from "@/lib/utils/build-clinical-timeline";

const PATIENT = "11111111-1111-4111-8111-111111111111";
const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260929100000_medical_orders_v2.sql"),
  "utf8"
);
const rollback = readFileSync(
  path.join(process.cwd(), "supabase/migrations/rollback/20260929100000_medical_orders_v2.down.sql"),
  "utf8"
);

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe("medical orders v2 — creation input", () => {
  it("accepts a lab order with catalog items and defaults priority to normal", () => {
    const parsed = medicalOrderInputSchema.parse({
      patient_id: PATIENT,
      category: "laboratorio",
      items: [{ name: "Hemograma completo" }, { name: "Glucemia", code: "GLU" }],
      valid_until: tomorrow(),
    });
    expect(parsed.priority).toBe("normal");
    expect(parsed.items).toHaveLength(2);
  });

  it("requires at least one requested study and a valid category", () => {
    expect(medicalOrderInputSchema.safeParse({ patient_id: PATIENT, category: "laboratorio", items: [] }).success).toBe(
      false
    );
    expect(
      medicalOrderInputSchema.safeParse({ patient_id: PATIENT, category: "cirugia", items: [{ name: "x" }] }).success
    ).toBe(false);
  });

  it("rejects a validity date in the past and a non-uuid patient", () => {
    expect(
      medicalOrderInputSchema.safeParse({
        patient_id: PATIENT,
        category: "otra",
        items: [{ name: "x" }],
        valid_until: "2000-01-01",
      }).success
    ).toBe(false);
    expect(
      medicalOrderInputSchema.safeParse({ patient_id: "not-a-uuid", category: "otra", items: [{ name: "x" }] }).success
    ).toBe(false);
  });

  it("covers the 8 order types", () => {
    expect(MEDICAL_ORDER_CATEGORIES).toHaveLength(8);
    for (const c of MEDICAL_ORDER_CATEGORIES) expect(MEDICAL_ORDER_CATEGORY_LABELS[c]).toBeTruthy();
  });

  it("composes order_text and imaging metadata", () => {
    const input = medicalOrderInputSchema.parse({
      patient_id: PATIENT,
      category: "imagenes",
      items: [{ name: "Resonancia magnética", imaging: { body_region: "Rodilla derecha", contrast: "sin" } }],
    });
    const text = composeMedicalOrderText(input);
    expect(text).toContain("Diagnóstico por imágenes");
    expect(text).toContain("Resonancia magnética");
    expect(text).toContain("Rodilla derecha");
    expect(text).toContain("Sin contraste");
    expect(buildItemMetadata(input.items[0]!)).toEqual({ body_region: "Rodilla derecha", contrast: "sin" });
  });

  it("cancellation requires a reason", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(cancelMedicalOrderSchema.safeParse({ order_id: id, reason: "" }).success).toBe(false);
    expect(cancelMedicalOrderSchema.safeParse({ order_id: id, reason: "Error de carga" }).success).toBe(true);
  });

  it("computes age from birth date", () => {
    expect(computeAge("2000-06-15", new Date("2026-06-14T12:00:00"))).toBe(25);
    expect(computeAge("2000-06-15", new Date("2026-06-15T12:00:00"))).toBe(26);
    expect(computeAge(null)).toBeNull();
  });
});

describe("medical orders v2 — permissions", () => {
  it("defaults: doctors issue; secretaries cannot view or issue; admins manage", () => {
    expect(hasPermission("doctor", "issueMedicalOrders")).toBe(true);
    expect(hasPermission("doctor", "cancelMedicalOrders")).toBe(true);
    expect(hasPermission("clinic_admin", "viewMedicalOrders")).toBe(true);
    expect(hasPermission("secretary", "viewMedicalOrders")).toBe(false);
    expect(hasPermission("secretary", "issueMedicalOrders")).toBe(false);
    expect(hasPermission("secretary", "shareMedicalOrders")).toBe(false);
  });

  it("clinic can grant a secretary view access via override", () => {
    expect(hasPermission("secretary", "viewMedicalOrders", false, { viewMedicalOrders: true })).toBe(true);
    expect(canAccessRoute("secretary", "/ordenes-medicas")).toBe(false);
    expect(canAccessRoute("secretary", "/ordenes-medicas", false, { viewMedicalOrders: true })).toBe(true);
  });

  it("new keys are manageable and grouped in the role matrix", () => {
    const keys = ["viewMedicalOrders", "issueMedicalOrders", "cancelMedicalOrders", "shareMedicalOrders"] as const;
    for (const k of keys) expect(MANAGEABLE_PERMISSION_KEYS).toContain(k);
    const group = PERMISSION_GROUPS.find((g) => g.id === "ordenes");
    expect(group?.keys).toEqual([...keys]);
  });
});

describe("medical orders v2 — DB safety (static checks on the migration)", () => {
  it("only adds nullable columns and never drops or rewrites existing data", () => {
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE|DROP COLUMN|DELETE FROM public\.medical_orders\b/i);
    expect(migration).not.toMatch(/UPDATE public\.medical_orders\s+SET/i);
    const addCols = migration.match(/ADD COLUMN IF NOT EXISTS [^\n]+/g) ?? [];
    expect(addCols.length).toBeGreaterThanOrEqual(18);
    for (const col of addCols) expect(col).not.toMatch(/NOT NULL/);
  });

  it("issued orders are immutable and cannot be deleted (only annulled with reason)", () => {
    expect(migration).toContain("MEDICAL_ORDER_IMMUTABLE");
    expect(migration).toContain("MEDICAL_ORDER_DELETE_FORBIDDEN");
    expect(migration).toContain("MEDICAL_ORDER_VOID_REASON_REQUIRED");
    expect(migration).toMatch(/BEFORE INSERT OR UPDATE OR DELETE ON public\.medical_order_items/);
  });

  it("numbering is server-side, per clinic and year, and not callable by clients", () => {
    expect(migration).toMatch(/ON CONFLICT \(clinic_id, year\)/);
    expect(migration).toMatch(/OM-/);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.next_medical_order_number\(UUID\) FROM PUBLIC, anon, authenticated/
    );
    expect(migration).toMatch(/idx_medical_orders_clinic_number/);
  });

  it("anti-impersonation: issuer must be the logged-in user's professional (null-safe)", () => {
    expect(migration).toContain("MEDICAL_ORDER_ISSUER_MISMATCH");
    expect(migration).toContain("COALESCE(v_pro.user_id = auth.uid(), false)");
  });

  it("public verification exposes minimal masked data only", () => {
    const fn = migration.slice(migration.indexOf("FUNCTION public.verify_medical_order"));
    expect(fn).toContain("'items_count'");
    expect(fn).not.toMatch(/'items',/);
    expect(fn).toContain("patient_initials");
    expect(fn).toContain("patient_document_masked");
    expect(fn).not.toMatch(/'patient_name'|'diagnosis/);
    expect(fn).toMatch(/GRANT EXECUTE ON FUNCTION public\.verify_medical_order\(TEXT\) TO anon/);
  });

  it("has a rollback that restores the previous select policy and permission keys", () => {
    expect(rollback).toMatch(/DROP TABLE IF EXISTS public\.medical_order_items/);
    expect(rollback).toMatch(/CREATE POLICY medical_orders_select/);
    expect(rollback).toMatch(/clinic_manageable_permission_keys/);
  });

  it("the signature is an internal placeholder and never claims official validity", () => {
    expect(migration).toContain("nexclinic_internal_validation_v1");
    expect(MEDICAL_ORDER_SIGNATURE_DISCLAIMER).toMatch(/No reemplaza/);
  });
});

describe("medical orders v2 — QR, errors and routing", () => {
  it("validates verification tokens and builds the public URL", () => {
    const token = "a".repeat(64);
    expect(isValidVerificationToken(token)).toBe(true);
    expect(isValidVerificationToken("../etc/passwd")).toBe(false);
    expect(isValidVerificationToken("A".repeat(64))).toBe(false);
    expect(buildMedicalOrderVerifyUrl("https://x.test/", token)).toBe(`https://x.test/verify/medical-order/${token}`);
  });

  it("verification page is public and uses the light theme", () => {
    expect(isPublicLightPath(`/verify/medical-order/${"a".repeat(64)}`)).toBe(true);
    const middleware = readFileSync(path.join(process.cwd(), "src/core/supabase/middleware.ts"), "utf8");
    expect(middleware).toContain('path.startsWith("/verify/")');
  });

  it("maps DB errors to Spanish messages without leaking SQL", () => {
    expect(mapMedicalOrderDbError("ERROR: MEDICAL_ORDER_IMMUTABLE")).toMatch(/no puede modificarse/);
    expect(mapMedicalOrderDbError('relation "x" violates row-level security')).toBe("Sin permisos para esta operación.");
    expect(mapMedicalOrderDbError("syntax error at or near SELECT secret")).toBe("No se pudo guardar la orden.");
  });

  it("detects a DB without the v2 schema (fail-safe for environments not migrated)", () => {
    expect(isMissingSchemaError({ code: "42703", message: 'column "order_number" does not exist' })).toBe(true);
    expect(isMissingSchemaError({ code: "42501", message: "permission denied" })).toBe(false);
  });
});

describe("medical orders v2 — timeline", () => {
  const base = {
    clinic_id: "c",
    patient_id: PATIENT,
    clinical_record_id: null,
    professional_id: "p",
    notes: null,
    created_by: "u",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    version: 1,
    issued_at: "2026-09-01T10:00:00Z",
  };

  it("shows number, type, professional and ANULADA; hides drafts", () => {
    const events = buildClinicalTimeline({
      patientId: PATIENT,
      consultations: [],
      attachments: [],
      prescriptions: [],
      appointments: [],
      orders: [
        {
          ...base,
          id: "o1",
          status: "void",
          order_type: "study",
          order_text: "Laboratorio\n- Hemograma completo",
          order_number: "OM-2026-00000007",
          order_category: "laboratorio",
          professional_name: "Dra. Pérez",
        },
        { ...base, id: "o2", status: "draft", order_type: "study", order_text: "x" },
      ],
    });
    const orderEvents = events.filter((e) => e.id.startsWith("o-"));
    expect(orderEvents).toHaveLength(1);
    expect(orderEvents[0]!.title).toContain("ANULADA");
    expect(orderEvents[0]!.title).toContain("OM-2026-00000007");
    expect(orderEvents[0]!.title).toContain("Laboratorio");
    expect(orderEvents[0]!.subtitle).toBe("Hemograma completo");
    expect(orderEvents[0]!.meta).toBe("Dra. Pérez");
  });
});
