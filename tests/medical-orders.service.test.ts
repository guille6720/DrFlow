import { describe, expect, it } from "vitest";

import {
  parseMedicalOrderForm,
  parseValidatedMedicalOrderInput,
  validateMedicalOrderInput,
} from "@/features/recetas/services/medical-orders.service";
import {
  normalizeMedicalOrderVersion,
  parseMedicalOrderExpectedVersion,
} from "@/features/recetas/utils/medical-order-version";

describe("medical-orders.service", () => {
  it("parseValidatedMedicalOrderInput trims and sanitizes order_text", () => {
    const fd = new FormData();
    fd.set("patient_id", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("professional_id", "550e8400-e29b-41d4-a716-446655440001");
    fd.set("order_text", "  RMN cerebral  ");
    fd.set("order_type", "study");

    const result = parseValidatedMedicalOrderInput(parseMedicalOrderForm(fd));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.order_text).toBe("RMN cerebral");
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

  it("normalizeMedicalOrderVersion defaults missing values to 1", () => {
    expect(normalizeMedicalOrderVersion(undefined)).toBe(1);
    expect(normalizeMedicalOrderVersion("3")).toBe(3);
    expect(normalizeMedicalOrderVersion(0)).toBe(1);
  });

  it("parseMedicalOrderExpectedVersion reads hidden form field", () => {
    const fd = new FormData();
    fd.set("expected_version", "4");
    expect(parseMedicalOrderExpectedVersion(fd)).toBe(4);
    expect(parseMedicalOrderExpectedVersion(new FormData())).toBeNull();
  });
});
