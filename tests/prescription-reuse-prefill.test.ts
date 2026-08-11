import { beforeEach, describe, expect, it } from "vitest";

import {
  consumePrescriptionReusePrefill,
  storePrescriptionReusePrefill,
} from "@/features/recetas/utils/prescription-reuse-prefill";

describe("prescription-reuse-prefill", () => {
  const patientId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    sessionStorage.clear();
  });

  it("stores and consumes prefill once", () => {
    storePrescriptionReusePrefill(patientId, {
      medications: [{ generic_name: "Losartán", quantity: 1, posology: "1/día" }],
      diagnosis_cie10: "I10",
      diagnosis_text: "HTA",
      sourcePrescriptionId: "rx-1",
    });

    const first = consumePrescriptionReusePrefill(patientId);
    expect(first?.medications[0]?.generic_name).toBe("Losartán");
    expect(first?.sourcePrescriptionId).toBe("rx-1");

    const second = consumePrescriptionReusePrefill(patientId);
    expect(second).toBeNull();
  });
});
