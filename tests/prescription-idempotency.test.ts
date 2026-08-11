import { describe, expect, it, vi } from "vitest";

import {
  issuePrescriptionRecord,
} from "@/features/recetas/services/prescriptions.service";
import { PRESCRIPTION_IDEMPOTENCY_CONFLICT } from "@/features/recetas/utils/prescription-idempotency";

import { createSupabaseTestDouble } from "./helpers/mock-supabase-client";

const VALID_UUID_A = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_B = "550e8400-e29b-41d4-a716-446655440001";
const DRAFT_ID = "660e8400-e29b-41d4-a716-446655440099";
const IDEMPOTENCY_KEY = "770e8400-e29b-41d4-a716-446655440088";

const issuedPrescription = {
  id: DRAFT_ID,
  clinic_id: "clinic-1",
  patient_id: VALID_UUID_A,
  professional_id: VALID_UUID_B,
  clinical_record_id: null,
  prescription_type: "ambulatoria",
  diagnosis_cie10: "I10",
  diagnosis_text: "HTA",
  patient_insurance: "Particular",
  coverage_kind: "PARTICULAR",
  insurance_number: null,
  insurance_plan: null,
  medications: [{ generic_name: "Losartán", quantity: 1, posology: "1/día" }],
  notes: null,
  validity_days: 30,
  disclaimer_accepted: true,
  status: "issued",
  prescription_number: "RX-AR-20260810-001",
  issued_at: "2026-08-10T12:00:00.000Z",
  refeps_status: "local",
  idempotency_key: IDEMPOTENCY_KEY,
  version: 1,
  dispensed_at: null,
  refeps_id: null,
  created_by: "user-1",
  created_at: "2026-08-10T12:00:00.000Z",
  updated_at: "2026-08-10T12:00:00.000Z",
};

describe("prescription issue idempotency", () => {
  it("returns existing prescription when idempotency key matches", async () => {
    const db = {
      from: vi.fn((table: string) => {
        if (table === "prescription_drafts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: issuedPrescription,
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        return { select: vi.fn(), insert: vi.fn() };
      }),
    };

    const result = await issuePrescriptionRecord(
      createSupabaseTestDouble(db),
      DRAFT_ID,
      "clinic-1",
      "user-1",
      IDEMPOTENCY_KEY
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(false);
      expect(result.data.id).toBe(DRAFT_ID);
    }
  });

  it("exports idempotency conflict message constant", () => {
    expect(PRESCRIPTION_IDEMPOTENCY_CONFLICT).toContain("idempotencia");
  });
});
