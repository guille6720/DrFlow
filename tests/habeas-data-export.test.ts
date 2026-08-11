import { describe, expect, it } from "vitest";

import {
  buildPatientHabeasDataPayload,
  countHabeasSections,
  HABEAS_DATA_EXPORT_VERSION,
  type PatientHabeasDataSections,
} from "@/core/compliance/habeas-data-export";

function emptySections(): PatientHabeasDataSections {
  return {
    clinical_records: [{ id: "cr-1" }],
    appointments: [],
    prescriptions: [{ id: "rx-1" }, { id: "rx-2" }],
    prescription_events: [],
    medical_orders: [],
    consent_records: [],
    attachments_metadata: [],
    cash_charges: [],
    payments: [],
    patient_ledger_entries: [],
    telemedicine_sessions: [],
    audit_trail: [],
    warnings: [],
  };
}

describe("habeas-data-export", () => {
  it("builds patient payload with version and summary", () => {
    const sections = emptySections();
    const payload = buildPatientHabeasDataPayload(
      { id: "p-1", first_name: "Ana", last_name: "Test" },
      sections,
      "2026-08-11T12:00:00.000Z"
    );

    expect(payload.export_version).toBe(HABEAS_DATA_EXPORT_VERSION);
    expect(payload.export_type).toBe("patient_habeas_data");
    expect(payload.summary.clinical_records).toBe(1);
    expect(payload.summary.prescriptions).toBe(2);
    expect(payload.audit_trail).toEqual([]);
    expect(payload.notes?.prescriptions).toMatch(/REFEPS/i);
  });

  it("includes warnings when present", () => {
    const sections = emptySections();
    sections.warnings = ["cash_charges: relation does not exist"];

    const payload = buildPatientHabeasDataPayload({ id: "p-1" }, sections, "2026-08-11T12:00:00.000Z");

    expect(payload.warnings).toEqual(["cash_charges: relation does not exist"]);
  });

  it("counts all section lengths", () => {
    const counts = countHabeasSections({
      ...emptySections(),
      audit_trail: [
        {
          id: "log-1",
          source: "audit_logs",
          action: "export",
          module: null,
          what: null,
          entityType: "patient",
          entityId: "p-1",
          occurredAt: "2026-08-11T12:00:00.000Z",
          actorName: "Dr",
          ipAddress: null,
          userAgent: null,
          oldValues: null,
          newValues: null,
        },
      ],
    });

    expect(counts.audit_trail).toBe(1);
    expect(counts.prescriptions).toBe(2);
  });
});
