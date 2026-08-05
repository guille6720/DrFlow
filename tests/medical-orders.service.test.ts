import { describe, expect, it } from "vitest";

import {
  parseMedicalOrderForm,
  validateMedicalOrderInput,
} from "@/features/recetas/services/medical-orders.service";

describe("medical-orders.service", () => {
  it("parseMedicalOrderForm extracts sanitized fields", () => {
    const fd = new FormData();
    fd.set("patient_id", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("professional_id", "550e8400-e29b-41d4-a716-446655440001");
    fd.set("order_text", "  RMN cerebral  ");
    fd.set("order_type", "study");

    const parsed = parseMedicalOrderForm(fd);
    expect(parsed.patient_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(parsed.order_text).toBe("RMN cerebral");
  });

  it("validateMedicalOrderInput rejects incomplete input", () => {
    expect(
      validateMedicalOrderInput({
        patient_id: "",
        professional_id: "550e8400-e29b-41d4-a716-446655440001",
        order_text: "x",
        notes: null,
        clinical_record_id: null,
        order_type: "study",
      })
    ).toBeTruthy();
  });
});
