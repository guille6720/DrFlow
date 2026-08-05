import { describe, expect, it } from "vitest";

import type { PatientRecordGroup } from "@/features/historias/components/historias/clinical-records-grouped-list";
import {
  buildHistoriasCopilotContextFromGroup,
  resolveHistoriasCopilotFocusGroup,
} from "@/features/ia/components/clinical-workflow/historias-copilot-utils";

const sampleGroup: PatientRecordGroup = {
  patientId: "p1",
  firstName: "Ana",
  lastName: "García",
  documentNumber: "123",
  phone: null,
  totalForPatient: 2,
  records: [
    {
      id: "r1",
      created_at: "2026-01-15T10:00:00.000Z",
      diagnosis: "Hipertensión",
      chief_complaint: "Control",
      professional_name: "Dr. López",
    },
  ],
};

describe("historias-copilot-utils", () => {
  it("builds copilot context from a patient group", () => {
    const ctx = buildHistoriasCopilotContextFromGroup(sampleGroup);
    expect(ctx.patientId).toBe("p1");
    expect(ctx.patientName).toBe("García, Ana");
    expect(ctx.recentConsultations?.[0]?.diagnosis).toBe("Hipertensión");
  });

  it("focuses a single search match or lone group", () => {
    expect(resolveHistoriasCopilotFocusGroup([sampleGroup], null)).toEqual(sampleGroup);
    expect(resolveHistoriasCopilotFocusGroup([sampleGroup], "p1")).toEqual(sampleGroup);
    expect(resolveHistoriasCopilotFocusGroup([sampleGroup, { ...sampleGroup, patientId: "p2" }], null)).toBeNull();
  });
});
