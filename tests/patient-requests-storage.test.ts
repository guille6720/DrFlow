import { describe, expect, it } from "vitest";

import {
  addPatientRequest,
  getWhatsappPatientRequests,
} from "@/features/pacientes/utils/patient-requests-storage";

describe("patient-requests-storage", () => {
  it("rejects web channel local persistence", () => {
    expect(() =>
      addPatientRequest("demo-slug", {
        type: "turno",
        channel: "web",
        documentNumber: "30123456",
        patientName: "Ana",
      })
    ).toThrow(/WhatsApp/i);
  });

  it("returns only whatsapp records from helper", () => {
    const items = getWhatsappPatientRequests("missing-slug-never-written");
    expect(items).toEqual([]);
  });
});
