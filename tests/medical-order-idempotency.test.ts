import { describe, expect, it, vi } from "vitest";

import { MEDICAL_ORDER_IDEMPOTENCY_CONFLICT } from "@/features/recetas/repositories/medical-orders.errors";
import {
  createMedicalOrderRecord,
  parseMedicalOrderForm,
} from "@/features/recetas/services/medical-orders.service";
import { isMedicalOrderUniqueViolation } from "@/features/recetas/utils/medical-order-idempotency";

import { createSupabaseTestDouble } from "./helpers/mock-supabase-client";

const VALID_UUID_A = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_B = "550e8400-e29b-41d4-a716-446655440001";
const IDEMPOTENCY_KEY = "660e8400-e29b-41d4-a716-446655440099";

const existingOrder = {
  id: "770e8400-e29b-41d4-a716-446655440088",
  clinic_id: "clinic-1",
  patient_id: VALID_UUID_A,
  professional_id: VALID_UUID_B,
  clinical_record_id: null,
  order_text: "Planilla PAMI renderizada",
  notes: "Internación domiciliaria",
  order_type: "pami_form",
  status: "issued",
  issued_at: "2026-08-07T12:00:00.000Z",
  created_by: "user-1",
  created_at: "2026-08-07T12:00:00.000Z",
  updated_at: "2026-08-07T12:00:00.000Z",
  version: 1,
};

function buildDb(existing: typeof existingOrder | null = null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: existing,
              error: null,
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: existingOrder,
            error: null,
          })),
        })),
      })),
    })),
  };
}

describe("medical-order idempotency", () => {
  it("detects postgres unique violations", () => {
    expect(isMedicalOrderUniqueViolation({ code: "23505" })).toBe(true);
    expect(isMedicalOrderUniqueViolation(MEDICAL_ORDER_IDEMPOTENCY_CONFLICT)).toBe(true);
    expect(isMedicalOrderUniqueViolation("foreign key violation")).toBe(false);
  });

  it("parseMedicalOrderForm forwards idempotency_key", () => {
    const fd = new FormData();
    fd.set("patient_id", VALID_UUID_A);
    fd.set("professional_id", VALID_UUID_B);
    fd.set("order_text", "Planilla");
    fd.set("order_type", "pami_form");
    fd.set("idempotency_key", IDEMPOTENCY_KEY);

    expect(parseMedicalOrderForm(fd).idempotency_key).toBe(IDEMPOTENCY_KEY);
  });

  it("returns existing order without creating when idempotency key matches", async () => {
    const db = buildDb(existingOrder);

    const result = await createMedicalOrderRecord(createSupabaseTestDouble(db), {
      patient_id: VALID_UUID_A,
      professional_id: VALID_UUID_B,
      order_text: "Planilla PAMI renderizada",
      notes: "Internación domiciliaria",
      clinical_record_id: null,
      order_type: "pami_form",
      idempotency_key: IDEMPOTENCY_KEY,
      clinicId: "clinic-1",
      userId: "user-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(false);
      expect(result.data.id).toBe(existingOrder.id);
    }
    expect(db.from).toHaveBeenCalledTimes(1);
  });

  it("creates a new order when idempotency key is absent", async () => {
    const db = buildDb(null);

    const result = await createMedicalOrderRecord(createSupabaseTestDouble(db), {
      patient_id: VALID_UUID_A,
      professional_id: VALID_UUID_B,
      order_text: "Planilla PAMI renderizada",
      notes: null,
      clinical_record_id: null,
      order_type: "pami_form",
      idempotency_key: null,
      clinicId: "clinic-1",
      userId: "user-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(true);
      expect(result.data.id).toBe(existingOrder.id);
    }
  });
});
