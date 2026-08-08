import { describe, expect, it } from "vitest";

import {
  buildPatientEhrWorkspaceData,
  mapEhrPrescriptions,
  mapTimelineAppointments,
} from "@/features/pacientes/server/load-patient-ehr-data";

const patient = {
  id: "pat-1",
  first_name: "Ana",
  last_name: "García",
  document_number: "12345678",
  phone: null,
  email: null,
  birth_date: "1980-01-01",
  insurance_provider: "OSDE",
  insurance_number: "111",
};

describe("mapEhrPrescriptions", () => {
  it("builds labels from medication names", () => {
    const result = mapEhrPrescriptions([
      {
        id: "rx-1",
        created_at: "2025-01-01T00:00:00.000Z",
        issued_at: "2025-01-01T01:00:00.000Z",
        status: "issued",
        medications: [{ generic_name: "Enalapril" }, { generic_name: "Aspirina" }],
      },
    ]);
    expect(result[0].label).toBe("Receta · Enalapril +1");
  });
});

describe("mapTimelineAppointments", () => {
  it("maps professional names", () => {
    const result = mapTimelineAppointments([
      {
        id: "a1",
        start_at: "2025-03-01T10:00:00.000Z",
        status: "attended",
        professionals: { profiles: { full_name: "Dr. López" } },
      },
    ]);
    expect(result[0].professional_name).toBe("Dr. López");
  });
});

describe("buildPatientEhrWorkspaceData", () => {
  it("uses sidebar consultation count when evolutions exist", () => {
    const ehr = buildPatientEhrWorkspaceData({
      patient,
      totalRecords: 42,
      mappedRecords: [
        {
          id: "r1",
          created_at: "2025-01-01T00:00:00.000Z",
          chief_complaint: "Control",
          diagnosis: "HTA",
          evolution: "Estable",
          indications: "",
          professional_name: "Dr. López",
        },
      ],
      attachments: [],
      rxList: [],
      orders: [],
      timelineAppointments: [],
      hceRows: null,
    });

    expect(ehr.totalConsultations).toBe(1);
    expect(ehr.consultations).toHaveLength(1);
    expect(ehr.usesHceExport).toBe(false);
  });
});
