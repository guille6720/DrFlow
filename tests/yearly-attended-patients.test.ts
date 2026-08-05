import { describe, expect, it } from "vitest";

import { buildYearlyAttendedPatients } from "@/lib/utils/yearly-attended-patients";

describe("buildYearlyAttendedPatients", () => {
  it("merges attended appointments and clinical records by patient", () => {
    const patients = buildYearlyAttendedPatients(
      [
        {
          patient_id: "p1",
          start_at: "2026-01-10T12:00:00.000Z",
          patients: {
            id: "p1",
            first_name: "Ana",
            last_name: "Pérez",
            document_number: "12345678",
            birth_date: "1980-01-01",
            phone: null,
            email: null,
            insurance_provider: "PAMI",
          },
        },
        {
          patient_id: "p1",
          start_at: "2026-03-15T12:00:00.000Z",
          patients: {
            id: "p1",
            first_name: "Ana",
            last_name: "Pérez",
            document_number: "12345678",
            birth_date: "1980-01-01",
            phone: null,
            email: null,
            insurance_provider: "PAMI",
          },
        },
      ],
      [
        {
          patient_id: "p2",
          created_at: "2026-02-01T12:00:00.000Z",
          patients: {
            id: "p2",
            first_name: "Juan",
            last_name: "López",
            document_number: "87654321",
            birth_date: null,
            phone: null,
            email: null,
            insurance_provider: null,
          },
        },
      ]
    );

    expect(patients).toHaveLength(2);
    expect(patients[0].id).toBe("p1");
    expect(patients[0].attentionCount).toBe(2);
    expect(patients[0].lastAttentionAt).toBe("2026-03-15T12:00:00.000Z");
    expect(patients[1].id).toBe("p2");
  });
});
