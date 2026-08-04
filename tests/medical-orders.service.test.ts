import { describe, expect, it } from "vitest";
import {
  parseMedicalOrderForm,
  validateMedicalOrderInput,
} from "@/lib/services/medical-orders.service";

describe("medical-orders.service", () => {
  it("parseMedicalOrderForm extracts sanitized fields", () => {
    const fd = new FormData();
    fd.set("patient_id", "p1");
    fd.set("professional_id", "pr1");
    fd.set("order_text", "  RMN cerebral  ");
    fd.set("order_type", "study");

    const parsed = parseMedicalOrderForm(fd);
    expect(parsed.patientId).toBe("p1");
    expect(parsed.orderText).toBe("RMN cerebral");
  });

  it("validateMedicalOrderInput rejects incomplete input", () => {
    expect(
      validateMedicalOrderInput({
        patientId: "",
        professionalId: "pr1",
        orderText: "x",
        notes: null,
        clinicalRecordId: null,
        orderType: "study",
      })
    ).toBeTruthy();
  });
});
