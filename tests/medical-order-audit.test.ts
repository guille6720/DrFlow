import { describe, expect, it } from "vitest";

import { auditFieldChanges } from "@/core/security/audit-log";

import {
  MEDICAL_ORDER_AUDIT_FIELD_KEYS,
  toMedicalOrderAuditSnapshot,
} from "@/features/recetas/services/medical-order-audit";

const baseOrder = {
  patient_id: "550e8400-e29b-41d4-a716-446655440000",
  clinical_record_id: "550e8400-e29b-41d4-a716-446655440001",
  professional_id: "550e8400-e29b-41d4-a716-446655440002",
  order_type: "study",
  order_text: "Hemograma completo",
  notes: "Ayuno 8 hs",
  status: "issued" as const,
};

describe("medical-order-audit", () => {
  it("includes all editable clinical fields in audit keys", () => {
    expect(MEDICAL_ORDER_AUDIT_FIELD_KEYS).toEqual([
      "patient_id",
      "clinical_record_id",
      "professional_id",
      "order_type",
      "order_text",
      "notes",
      "status",
    ]);
  });

  it("toMedicalOrderAuditSnapshot normalizes nullable fields", () => {
    expect(toMedicalOrderAuditSnapshot(baseOrder)).toEqual(baseOrder);
    expect(
      toMedicalOrderAuditSnapshot({
        ...baseOrder,
        clinical_record_id: null,
        notes: null,
        order_type: undefined,
      })
    ).toEqual({
      ...baseOrder,
      clinical_record_id: null,
      notes: null,
      order_type: "study",
    });
  });

  it("auditFieldChanges omits unchanged fields on update", () => {
    const before = toMedicalOrderAuditSnapshot(baseOrder);
    const after = toMedicalOrderAuditSnapshot({
      ...baseOrder,
      order_text: "RMN cerebral",
      notes: "Sin contraste",
    });

    const { oldValues, newValues } = auditFieldChanges(
      before,
      after,
      MEDICAL_ORDER_AUDIT_FIELD_KEYS
    );

    expect(oldValues).toEqual({
      order_text: "Hemograma completo",
      notes: "Ayuno 8 hs",
    });
    expect(newValues).toEqual({
      order_text: "RMN cerebral",
      notes: "Sin contraste",
    });
    expect(oldValues).not.toHaveProperty("patient_id");
    expect(oldValues).not.toHaveProperty("professional_id");
  });

  it("auditFieldChanges records only status on void", () => {
    const before = toMedicalOrderAuditSnapshot(baseOrder);
    const after = { ...before, status: "void" as const };

    const { oldValues, newValues } = auditFieldChanges(
      before,
      after,
      MEDICAL_ORDER_AUDIT_FIELD_KEYS
    );

    expect(oldValues).toEqual({ status: "issued" });
    expect(newValues).toEqual({ status: "void" });
  });
});
